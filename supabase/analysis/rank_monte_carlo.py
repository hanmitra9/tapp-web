"""Monte Carlo (10,000 runs) of TAPP creator economics under a rank/bonus scheme.

Money flow per Rp of creator earnings (live pricing): brand pays budget B; 18% platform fee; creators get 80% of the
rest -> creator pool = 0.574 B. So each Rp a creator earns was bought with 1/0.574 Rp of brand money (unspent
budget is assumed refunded, the conservative case). TAPP then pays the level bonus at withdrawal, the referral bonus,
the transfer cost of each withdrawal (creator pays a flat Rp10.000 fee), payment-gateway cost on brand top-ups and
any earnings that turn out fraudulent after they were already paid out.
"""
import numpy as np

RNG = np.random.default_rng(20261017)
SIMS, MONTHS = 10_000, 12
POOL = 0.82 * 0.80          # creator share of each brand Rp (18% brand fee, 20% creator fee)
FEE = 5_000                 # flat withdrawal fee charged to the creator
MIN_PAYOUT = 50_000
REFERRAL = 20_000

def schemes():
    # thresholds: lifetime qualified views; quality: min approved clips and approval rate; bonus % at withdrawal
    return {
        'current':  dict(views=[0, 50e3, 250e3, 1e6, 5e6], clips=[0, 0, 0, 0, 0], rate=[0, 0, 0, 0, 0], bonus=[0, 2, 5, 10, 15]),
        'konten':   dict(views=[0, 2e6, 30e6, 100e6, 500e6], clips=[0, 0, 0, 0, 0], rate=[0, 0, 0, 0, 0], bonus=[0, 5, 10, 15, 20]),
        'rank_v2':  dict(views=[0, 150e3, 1e6, 3e6, 10e6], clips=[0, 3, 10, 25, 60], rate=[0, 0, .60, .70, .75], bonus=[0, 3, 6, 10, 15]),   # migration 0059
    }

def run(s, n_sims=SIMS):
    out = {k: [] for k in ('profit', 'margin', 'min_creator', 'min_withdrawal', 'bonus_share', 'tier_mix', 'loss_runs')}
    for _ in range(n_sims):
        n = RNG.integers(200, 3001)                                   # active creators
        mu, sig = RNG.uniform(9.0, 11.5), RNG.uniform(1.2, 2.2)       # monthly qualified views ~ lognormal (heavy tail)
        brand_cpm = RNG.uniform(2_500, 10_000)
        creator_cpm = brand_cpm * 0.80
        transfer_cost = RNG.uniform(2_500, 7_500)                     # per disbursement
        gateway = RNG.uniform(0.005, 0.025)                           # of brand money collected
        fraud = RNG.uniform(0.0, 0.06)                                # share of paid earnings later reversed, unrecoverable
        referred = RNG.uniform(0.0, 0.5)                              # share of creators who came by referral
        approval = RNG.beta(6, 2, n)                                  # each creator's approval rate
        clips_pm = RNG.poisson(RNG.uniform(2, 12), n)                 # approved clips per month
        churn = RNG.uniform(0.03, 0.15)

        views_life = np.zeros(n); clips_life = np.zeros(n); bal = np.zeros(n)
        alive = np.ones(n, bool); paid_any = np.zeros(n, bool)
        contrib = np.zeros(n)                                         # TAPP margin left after every cost, per creator
        w_min = np.inf; bonus_total = 0.0; earn_total = 0.0; profit = 0.0
        ref_owner = RNG.random(n) < referred                          # this creator brings a referral bonus to someone

        for m in range(MONTHS):
            alive &= RNG.random(n) > churn
            v = np.where(alive, RNG.lognormal(mu, sig, n) * (1 + 0.05 * m), 0)
            earn = v / 1000 * creator_cpm
            views_life += v; clips_life += np.where(alive, clips_pm, 0); bal += earn
            brand_money = earn / POOL
            m_rev = brand_money - earn - brand_money * gateway
            contrib += m_rev; profit += m_rev.sum(); earn_total += earn.sum()

            # rank from lifetime views + quality
            tier = np.zeros(n, int)
            for t in range(1, 5):
                ok = (views_life >= s['views'][t]) & (clips_life >= s['clips'][t]) & (approval >= s['rate'][t])
                tier = np.where(ok, t, tier)
            pct = np.array(s['bonus'])[tier] / 100

            # withdraw whenever balance >= minimum (monthly)
            w = bal >= MIN_PAYOUT
            bonus = np.where(w, bal * pct, 0)
            cost = np.where(w, transfer_cost - FEE + bal * fraud, 0) + bonus
            # first payout triggers the referral bonus paid to whoever invited this creator
            first = w & ~paid_any & ref_owner
            cost += np.where(first, REFERRAL, 0)
            paid_any |= w
            contrib -= cost; profit -= cost.sum(); bonus_total += bonus.sum()
            if w.any():
                per_w = (bal / POOL - bal - bal / POOL * gateway)[w] - cost[w]   # margin of that withdrawal's earnings minus its costs
                w_min = min(w_min, per_w.min())
            bal = np.where(w, 0, bal)

        out['profit'].append(profit); out['margin'].append(profit / max(earn_total / POOL, 1))
        out['min_creator'].append(contrib[paid_any].min() if paid_any.any() else 0)
        out['min_withdrawal'].append(w_min)
        out['bonus_share'].append(bonus_total / max(earn_total, 1))
        out['tier_mix'].append(np.bincount(tier, minlength=5) / n)
        out['loss_runs'].append(profit < 0)
    return {k: np.array(v) for k, v in out.items()}

if __name__ == '__main__':
    for name, s in schemes().items():
        r = run(s)
        mix = r['tier_mix'].mean(0) * 100
        print(f"== {name}: bonus {s['bonus']}%")
        print(f"   runs with a loss: {r['loss_runs'].sum()} / {SIMS}")
        print(f"   min profit Rp{r['profit'].min():,.0f}   median margin {np.median(r['margin'])*100:.1f}%   p1 margin {np.percentile(r['margin'],1)*100:.1f}%")
        print(f"   worst single withdrawal margin Rp{r['min_withdrawal'].min():,.0f}   worst creator lifetime margin Rp{r['min_creator'].min():,.0f}")
        print(f"   bonus cost = {np.median(r['bonus_share'])*100:.2f}% of creator earnings (p99 {np.percentile(r['bonus_share'],99)*100:.2f}%)")
        print(f"   creators per rank (avg %): " + ' / '.join(f'{x:.1f}' for x in mix))

# --- Result of the 10,000-run comparison used for migration 0059 (seed 20261017) ---
# sekarang: rugi 0/10000 | profit min Rp53,365,276 | margin median 34.9% (p1 30.6%) | bonus 8.47% (p99 13.41%) | penarikan terburuk Rp14,750 | kreator terburuk Rp15,066 | sebaran rank 18.3 / 17.1 / 30.4 / 28.1 / 6.0
# kontencom: rugi 0/10000 | profit min Rp71,061,795 | margin median 38.5% (p1 34.2%) | bonus 1.95% (p99 7.41%) | penarikan terburuk Rp14,835 | kreator terburuk Rp15,142 | sebaran rank 81.1 / 18.5 / 0.3 / 0.0 / 0.0
# baru: rugi 0/10000 | profit min Rp43,651,927 | margin median 37.1% (p1 33.7%) | bonus 4.51% (p99 7.85%) | penarikan terburuk Rp14,771 | kreator terburuk Rp15,167 | sebaran rank 29.2 / 42.8 / 21.1 / 6.2 / 0.7
# fee brand 18% / kreator 20% / tarik Rp5.000 (0062): rugi 0/10000 | profit min Rp31,816,837 | margin median 27.9% (p1 24.3%) | bonus 4.50% (p99 7.85%) | penarikan terburuk -Rp880

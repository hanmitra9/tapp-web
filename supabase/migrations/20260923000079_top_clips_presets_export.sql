-- TAPP · 0079 · Example clips per campaign, editable review reasons, finance CSV export.
--   1. campaign_top_clips: the 3 accepted clips with the most views in a campaign, as inspiration on the campaign
--      page (creator name shortened like the leaderboard; the post itself is public).
--   2. Review reason templates: the admin keeps the preset reasons for reject / revise / flag in app_settings
--      ('review_presets') instead of in code.
--   3. admin_finance_export(month): every money movement in a month (brand deposits and refunds from brand_ledger,
--      paid creator withdrawals) as rows for a CSV.

set search_path = public, extensions;

-- ─────────────────────────────── 1. example clips ───────────────────────────────
create or replace function public.campaign_top_clips(p_campaign uuid)
returns table (rank bigint, name text, platform public.platform, post_url text, views bigint, published_at timestamptz)
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  return query
  with c as (
    select s.id, s.creator_id, s.platform, s.post_url, s.published_at,
      greatest(s.qualified_views, coalesce((select m.views from public.content_metrics m where m.submission_id = s.id
                                            order by m.captured_at desc limit 1), 0))::bigint as v
    from public.submissions s
    where s.campaign_id = p_campaign and s.status in ('approved', 'tracking', 'completed') and s.content_state in ('live', 'unknown')
  )
  select row_number() over (order by c.v desc, c.id),
    case when c.creator_id = v_uid then 'Kamu' else left(coalesce(p.username::text, p.full_name, 'creator'), 2) || '•••' end,
    c.platform, c.post_url, c.v, c.published_at
  from c left join public.profiles p on p.id = c.creator_id
  where c.v > 0
  order by c.v desc, c.id limit 3;
end $$;
revoke execute on function public.campaign_top_clips(uuid) from public, anon;
grant execute on function public.campaign_top_clips(uuid) to authenticated;

-- ─────────────────────────────── 2. review reason templates ───────────────────────────────
insert into public.app_settings (key, value) values ('review_presets', jsonb_build_object(
  'rejected', jsonb_build_array('Konten tidak sesuai format yang diminta campaign.', 'Postingan dipublikasikan sebelum kreator bergabung.',
    'Diposting dari akun yang tidak terhubung ke TAPP.', 'Konten melanggar panduan brand.', 'Terindikasi reupload atau bukan konten milik kreator.'),
  'needs_changes', jsonb_build_array('Tambahkan tag atau mention brand di caption.', 'Tambahkan hashtag wajib campaign.',
    'Durasi klip tidak sesuai syarat.', 'Caption tidak sesuai brief.'),
  'flagged', jsonb_build_array('Views atau engagement mencurigakan, perlu dicek ulang.', 'Postingan tidak bisa diakses publik.')))
on conflict (key) do nothing;

create or replace function public.admin_review_presets() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.assert_admin();
  return coalesce((select value from public.app_settings where key = 'review_presets'), '{}'::jsonb);
end $$;

create or replace function public.admin_set_review_presets(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); v_old jsonb; v_new jsonb := '{}'::jsonb; k text;
begin
  foreach k in array array['rejected', 'needs_changes', 'flagged'] loop
    if jsonb_typeof(p->k) is distinct from 'array' then raise exception 'presets_invalid'; end if;
    v_new := v_new || jsonb_build_object(k, coalesce((
      select jsonb_agg(t order by o) from (
        select distinct on (btrim(x)) btrim(x) t, o from jsonb_array_elements_text(p->k) with ordinality a(x, o)
        where length(btrim(x)) between 1 and 200 order by btrim(x), o) d), '[]'::jsonb));
    if jsonb_array_length(v_new->k) > 20 then raise exception 'presets_too_many'; end if;
  end loop;
  select value into v_old from public.app_settings where key = 'review_presets';
  insert into public.app_settings (key, value) values ('review_presets', v_new)
  on conflict (key) do update set value = excluded.value, updated_at = now();
  perform public.write_audit('settings.review_presets', 'app_setting', null, v_old, v_new);
  return v_new;
end $$;
revoke execute on function public.admin_review_presets(), public.admin_set_review_presets(jsonb) from public, anon;
grant execute on function public.admin_review_presets(), public.admin_set_review_presets(jsonb) to authenticated;

-- ─────────────────────────────── 3. finance export ───────────────────────────────
create or replace function public.admin_finance_export(p_month date)
returns table (at timestamptz, kind text, party text, campaign text, invoice text, amount bigint, fee bigint, net bigint, reference text, note text)
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_from timestamptz; v_to timestamptz;
begin
  perform public.assert_admin();
  v_from := date_trunc('month', coalesce(p_month, (now() at time zone 'Asia/Jakarta')::date))::timestamp at time zone 'Asia/Jakarta';
  v_to := (date_trunc('month', coalesce(p_month, (now() at time zone 'Asia/Jakarta')::date)) + interval '1 month')::timestamp at time zone 'Asia/Jakarta';
  return query
  select l.created_at, case l.kind when 'deposit' then 'Deposit brand' else 'Refund brand' end, b.name::text, c.title::text, l.invoice_no,
    l.amount, l.fee, l.net, l.reference, l.note
  from public.brand_ledger l join public.brands b on b.id = l.brand_id left join public.campaigns c on c.id = l.campaign_id
  where l.created_at >= v_from and l.created_at < v_to
  union all
  select p.paid_at, 'Pencairan kreator', coalesce(pr.full_name, pr.username::text, 'kreator'), null::text, null::text,
    p.amount::bigint, coalesce(p.fee, 0)::bigint, p.net_amount::bigint, p.processed_reference,
    concat_ws(' · ', concat_ws(' ', p.payout_method->>'provider',
      case when coalesce(p.payout_method->>'account_number', '') <> '' then '••••' || right(p.payout_method->>'account_number', 4) end),
      case when coalesce(p.bonus, 0) + coalesce(p.referral_bonus, 0) > 0 then 'bonus ' || (coalesce(p.bonus, 0) + coalesce(p.referral_bonus, 0)) end)
  from public.payout_requests p left join public.profiles pr on pr.id = p.creator_id
  where p.status = 'paid' and p.paid_at >= v_from and p.paid_at < v_to
  order by 1;
end $$;
revoke execute on function public.admin_finance_export(date) from public, anon;
grant execute on function public.admin_finance_export(date) to authenticated;

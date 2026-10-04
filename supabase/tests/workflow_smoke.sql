-- End-to-end workflow + abuse cases. Run against a local DB with _local_stubs.sql applied.
\set ON_ERROR_STOP 1
create or replace function pg_temp.act(uid uuid) returns void language sql as $$ select set_config('request.jwt.claim.sub', uid::text, false) $$;
create or replace function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then
    if sqlerrm like code || '%' then raise notice 'ok  (blocked: %)', sqlerrm; return; end if;
    raise exception 'expected % but got: %', code, sqlerrm;
  end;
  raise exception 'expected error % but statement succeeded: %', code, sql;
end $$;
grant execute on all functions in schema pg_temp to authenticated;

-- users: admin, brand, creator A, creator B
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a','admin@tapp.id', now(), '{"full_name":"Admin"}'),
 ('00000000-0000-0000-0000-00000000000b','brand@acme.id', now(), '{"full_name":"Brand"}'),
 ('00000000-0000-0000-0000-0000000000c1','c1@x.id', now(), '{"full_name":"Creator One"}'),
 ('00000000-0000-0000-0000-0000000000c2','c2@x.id', null,  '{"full_name":"Creator Two"}');
update profiles set role='admin' where id='00000000-0000-0000-0000-00000000000a';
update app_settings set value = 'false'::jsonb where key = 'require_admin_mfa';   -- MFA has its own section at the end
update app_settings set value = '100'::jsonb where key = 'creator_share_pct';    -- brand price = creator rate until the pricing section
update profiles set role='brand' where id='00000000-0000-0000-0000-00000000000b';
insert into brands (id,name,slug) values ('10000000-0000-0000-0000-000000000001','Acme Finance','acme');
insert into brand_members values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','owner');

set role authenticated;

-- Creator 1 onboarding
select pg_temp.act('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_error($$update creator_profiles set status='active' where user_id=auth.uid()$$, 'permission denied');
select pg_temp.expect_error($$update profiles set role='admin' where id=auth.uid()$$, 'permission denied');
insert into creator_platforms (creator_id,platform,handle,is_primary) values (auth.uid(),'tiktok','kingclips',true);
insert into creator_payout_methods (creator_id,kind,provider,account_name,account_number) values (auth.uid(),'bank','BCA','Creator One','1234567890');
select pg_temp.expect_error($$select join_campaign('20000000-0000-0000-0000-000000000001')$$, 'creator_not_eligible:pending');
select status from complete_creator_onboarding('Creator One','king.clips','ID','tiktok',array['finance'],array['podcast'],'fast cuts','{}','intermediate');

-- Creator 2 not verified
select pg_temp.act('00000000-0000-0000-0000-0000000000c2');
select pg_temp.expect_error($$select complete_creator_onboarding('C2','c.two','ID','tiktok',array['finance'],null,null,null,null)$$, 'email_not_verified');
select pg_temp.expect_error($$insert into creator_platforms (creator_id,platform,handle) values (auth.uid(),'tiktok','KINGCLIPS')$$, 'duplicate key');

-- Brand drafts campaign
select pg_temp.act('00000000-0000-0000-0000-00000000000b');
insert into campaigns (id,brand_id,title,category,cpm,budget,created_by,submission_deadline)
 values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Finance podcast clips','finance',3000,600000,auth.uid(), now()+interval '30 days');
insert into campaign_platforms values ('20000000-0000-0000-0000-000000000001','tiktok');
insert into campaign_assets (campaign_id,kind,title,url) values ('20000000-0000-0000-0000-000000000001','video','Ep. 12 raw','https://drive.example/ep12');
select status from submit_campaign_for_approval('20000000-0000-0000-0000-000000000001');
update campaigns set budget=1 where id='20000000-0000-0000-0000-000000000001';  -- RLS: 0 rows (no longer draft)
select budget from campaigns where id='20000000-0000-0000-0000-000000000001';

-- Admin approves creator + campaign
select pg_temp.act('00000000-0000-0000-0000-00000000000a');
select status from admin_set_creator_status('00000000-0000-0000-0000-0000000000c1','active');
select status from admin_set_campaign_status('20000000-0000-0000-0000-000000000001','active');

-- Creator joins & submits
select pg_temp.act('00000000-0000-0000-0000-0000000000c1');
select count(*) as assets_before_join from campaign_assets;
select status from join_campaign('20000000-0000-0000-0000-000000000001');
select status from join_campaign('20000000-0000-0000-0000-000000000001'); -- idempotent
select count(*) as assets_after_join from campaign_assets;
select pg_temp.expect_error($$select submit_content('20000000-0000-0000-0000-000000000001','tiktok','not a url',now())$$,'invalid_url');
select pg_temp.expect_error($$select submit_content('20000000-0000-0000-0000-000000000001','tiktok','https://www.instagram.com/reel/Abc123/',now())$$,'url_platform_mismatch');
select pg_temp.expect_error($$select submit_content('20000000-0000-0000-0000-000000000001','tiktok','https://vm.tiktok.com/ZSabc/',now())$$,'short_link_not_allowed');
select pg_temp.expect_error($$select submit_content('20000000-0000-0000-0000-000000000001','tiktok','https://www.tiktok.com/@kingclips/video/7412',now()-interval '3 days')$$,'published_before_join');
select id as sub_id, status, normalized_url from submit_content('20000000-0000-0000-0000-000000000001','tiktok','https://www.TikTok.com/@kingclips/video/7412?is_from_webapp=1',now()) \gset
select (select id from submit_content('20000000-0000-0000-0000-000000000001','tiktok','https://tiktok.com/@kingclips/video/7412/',now())) = :'sub_id' as retry_is_idempotent;
select pg_temp.expect_error(format($$select admin_review_submission(%L,'approved')$$, :'sub_id'),'forbidden');
select pg_temp.expect_error($$insert into earnings (creator_id,campaign_id,submission_id,snapshot_id,qualified_views_delta,cpm,amount,status,available_at) values (auth.uid(),'20000000-0000-0000-0000-000000000001',gen_random_uuid(),gen_random_uuid(),1,1,999999,'available',now())$$,'permission denied');

-- Admin reviews, records metrics, qualifies
select pg_temp.act('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error(format($$select admin_review_submission(%L,'rejected')$$, :'sub_id'),'reason_required');
select status from admin_review_submission(:'sub_id','approved');
select id as metric_id from admin_record_metrics(:'sub_id', 250000, 9000, 300, 120, 80) \gset
select status from submissions where id = :'sub_id';
select pg_temp.expect_error(format($$select admin_qualify_views(%L,%L,300000)$$, :'sub_id', :'metric_id'),'qualified_exceeds_raw');
select qualified_views, budget_capped from admin_qualify_views(:'sub_id', :'metric_id', 185000, 'bot filter');
select earned, qualified_views from submissions where id = :'sub_id';            -- expect 555000 / 185000
-- more views → budget cap (600k budget, 555k used)
select id as metric2 from admin_record_metrics(:'sub_id', 400000) \gset
select qualified_views, budget_capped from admin_qualify_views(:'sub_id', :'metric2', 300000);
select budget, earned, status, status_reason from campaigns where id='20000000-0000-0000-0000-000000000001';  -- earned 600000, ending
select pg_temp.expect_error($$update content_metrics set views = 1$$,'permission denied');
reset role; select pg_temp.expect_error($$update content_metrics set views = 1$$,'append_only'); set role authenticated;

-- Wallet (0045): accepted views are credited to the balance; the creator withdraws (flat fee, level bonus on top).
select pg_temp.act('00000000-0000-0000-0000-0000000000c1');
select * from my_earnings_summary;
select pg_temp.expect_error($$select request_payout(gen_random_uuid())$$,'payout_below_minimum');      -- still on hold
select pg_temp.expect_error(format($$select admin_credit_submission(%L, 300000)$$, :'sub_id'),'forbidden');
select pg_temp.act('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error(format($$select admin_credit_submission(%L, 100)$$, :'sub_id'),'views_below_paid');
select pg_temp.expect_error(format($$select admin_pay_submission(%L, 300000, 'X')$$, :'sub_id'),'use_admin_credit_submission');
select status from admin_credit_submission(:'sub_id', 300000);                       -- completed
select pg_temp.act('00000000-0000-0000-0000-0000000000c1');
do $$ begin if (select available from my_earnings_summary) <> 600000 then raise exception 'credit should be withdrawable'; end if; end $$;
select id as payout_id, amount, fee, bonus, net_amount, status from request_payout(gen_random_uuid()) \gset
select pg_temp.expect_error($$select request_payout(gen_random_uuid())$$,'payout_already_open');
do $$ declare p public.payout_requests; begin
  select * into p from payout_requests order by created_at desc limit 1;
  if p.amount <> 600000 or p.fee <> 118000 or p.fee_pct <> 18 then raise exception 'withdrawal fee should be 18%% + 10.000: % % %', p.amount, p.fee, p.fee_pct; end if;
  if p.bonus <> round(p.amount * tier_bonus_pct(p.fee_tier) / 100) then raise exception 'bonus wrong'; end if;
  if p.net_amount <> p.amount + p.bonus - p.fee then raise exception 'net wrong'; end if;
end $$;
select pg_temp.act('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error(format($$select admin_update_payout(%L,'paid', null, ' ')$$, :'payout_id'),'reference_required');
select status from admin_update_payout(:'payout_id', 'paid', null, 'BCA-TRX-88231');   -- straight from the queue
select pg_temp.expect_error(format($$select admin_update_payout(%L,'paid', null, 'again')$$, :'payout_id'),'invalid_transition');
select earned, paid from campaigns where id='20000000-0000-0000-0000-000000000001';

select pg_temp.act('00000000-0000-0000-0000-0000000000c1');
select * from my_earnings_summary;
select campaign_title, amount, fee, bonus, net_amount, processed_reference from my_payments;
do $$ begin if (select count(*) from my_payments) <> 1 or (select net_amount from my_payments) <> 600000 + (select bonus from my_payments) - (select fee from my_payments) then raise exception 'my_payments wrong'; end if; end $$;
select type, body from notifications order by created_at;
select count(*) as audit_rows_visible_to_creator from audit_logs;  -- expect 0

-- ── Phase 2: profile ──
select pg_temp.act('00000000-0000-0000-0000-0000000000c2');
select is_username_available('king.clips') as taken_expect_f, is_username_available('KING.CLIPS') as case_expect_f,
       is_username_available('admin') as reserved_expect_f, is_username_available('new.creator') as free_expect_t,
       is_username_available('ab') as short_expect_f;
select pg_temp.act('00000000-0000-0000-0000-0000000000c1');
select is_username_available('king.clips') as own_expect_t;
select pg_temp.expect_error($$update profiles set username='admin' where id=auth.uid()$$, 'new row for relation "profiles" violates check');
select pg_temp.expect_error($$update creator_profiles set niches=array['a','b','c','d'] where user_id=auth.uid()$$, 'new row for relation "creator_profiles" violates check');
insert into creator_platforms (creator_id,platform,handle) values (auth.uid(),'instagram','king.ig');
-- the rest of this suite keeps working with c1's clip as a live, tracked one (as before 0035's direct payout)
reset role; update submissions set status = 'tracking' where id = :'sub_id'; set role authenticated;
delete from creator_platforms where creator_id=auth.uid() and platform='tiktok';   -- has a tracking submission → RLS keeps it
select count(*) as tiktok_kept_expect_1 from creator_platforms where platform='tiktok';
update creator_profiles set main_platform='instagram' where user_id=auth.uid();
delete from creator_platforms where creator_id=auth.uid() and platform='instagram';
select main_platform as main_fallback_expect_tiktok from creator_profiles;
select campaigns_joined, submissions, approved, qualified_views, total_earned from my_creator_stats;

-- ── Phase 3: marketplace ──
reset role;
insert into campaigns (id,brand_id,title,category,content_type,cpm,budget,status,submission_deadline) values
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Crypto explainer clips','crypto','tutorial',5000,1000000,'active', now()+interval '3 days'),
 ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','Finance podcast S2','finance','podcast_clips',2500,2000000,'active', now()+interval '20 days'),
 ('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','YouTube only','finance','podcast_clips',9000,2000000,'active', null);
insert into campaign_platforms values ('20000000-0000-0000-0000-000000000002','tiktok'),('20000000-0000-0000-0000-000000000003','tiktok'),
 ('20000000-0000-0000-0000-000000000003','instagram'),('20000000-0000-0000-0000-000000000004','youtube');
set role authenticated;
select pg_temp.act('00000000-0000-0000-0000-0000000000c1');
select title, match_score, match_reasons, joined from campaign_feed();                        -- S2 first; YouTube-only hidden; ending campaign hidden
select title from campaign_feed(p_sort => 'cpm');                                             -- crypto (5000) first
select title from campaign_feed(p_categories => array['crypto']);
select title from campaign_feed(p_ending_within_days => 7);
select count(*) as yt_filter_expect_0 from campaign_feed(p_platforms => array['youtube']::platform[]);
select get_campaign('20000000-0000-0000-0000-000000000004')->>'join_block' as block_expect_platform;
select get_campaign('20000000-0000-0000-0000-000000000003')->>'join_block' as block_expect_null;
select status from join_campaign('20000000-0000-0000-0000-000000000003');
select (get_campaign('20000000-0000-0000-0000-000000000003')->'membership'->>'status') as member_expect_joined,
       (get_campaign('20000000-0000-0000-0000-000000000003')->>'creators_joined') as joined_count;
select creator_home();
select pg_temp.act('00000000-0000-0000-0000-0000000000c2');
select count(*) as unverified_feed from campaign_feed();                                      -- c2 has no platforms → 0
select get_campaign('20000000-0000-0000-0000-000000000003')->>'join_block' as block_expect_creator;
select pg_temp.expect_error($$select get_campaign('20000000-0000-0000-0000-0000000000ff')$$, 'campaign_not_found');

-- ── Phase 4: submissions ──
select pg_temp.act('00000000-0000-0000-0000-0000000000c1');
select id as s2 from submit_content('20000000-0000-0000-0000-000000000003','tiktok','https://www.tiktok.com/@kingclips/video/9001',now()) \gset
select (select id from submit_content('20000000-0000-0000-0000-000000000003','tiktok','https://tiktok.com/@kingclips/video/9001?x=1',now())) = :'s2' as idempotent_expect_t;
select pg_temp.expect_error($$select submit_content('20000000-0000-0000-0000-000000000001','tiktok','https://www.tiktok.com/@kingclips/video/9002',now())$$,'campaign_not_accepting');
select pg_temp.expect_error(format($$select resubmit_content(%L,'tiktok','https://www.tiktok.com/@kingclips/video/9003',now())$$, :'s2'),'submission_not_editable');
select pg_temp.act('00000000-0000-0000-0000-00000000000a');
select status from admin_review_submission(:'s2','needs_changes','Tambahkan tag brand di caption.');
select pg_temp.act('00000000-0000-0000-0000-0000000000c1');
select status, review_reason from my_submissions where id = :'s2';
select status, post_url from resubmit_content(:'s2','tiktok','https://www.tiktok.com/@kingclips/video/9003',now(),'@ruangcuan');
select pg_temp.expect_error(format($$select resubmit_content(%L,'tiktok','https://www.tiktok.com/@kingclips/video/7412',now())$$, :'s2'),'submission_not_editable');
select withdraw_submission(:'s2');
select count(*) as withdrawn_expect_0 from submissions where id = :'s2';
select status from submit_content('20000000-0000-0000-0000-000000000003','tiktok','https://www.tiktok.com/@kingclips/video/9003',now());
select pg_temp.expect_error($$select withdraw_submission((select id from submissions where normalized_url like '%7412'))$$,'submission_not_editable');
select campaign_title, status, raw_views, qualified_views, earned from my_submissions order by created_at;
select pg_temp.act('00000000-0000-0000-0000-0000000000c2');
select count(*) as other_creator_sees_expect_0 from my_submissions;
select pg_temp.expect_error($$select check_submission('20000000-0000-0000-0000-000000000003', auth.uid(), 'tiktok', 'x', now(), null)$$,'permission denied');

-- ── Phase 5: verification read models ──
select pg_temp.act('00000000-0000-0000-0000-00000000000a');
select campaign_title, creator_username, account_handle, status, views, metric_count, creator_approved from admin_submissions order by created_at;
select * from admin_queue_counts;
select pg_temp.act('00000000-0000-0000-0000-0000000000c2');
select count(*) as c2_sees_expect_0 from admin_submissions;
select pg_temp.expect_error($$select admin_verify_platform((select id from creator_platforms limit 1), true)$$,'forbidden');
select pg_temp.act('00000000-0000-0000-0000-00000000000a');
select verified_at is not null as verified_expect_t from admin_verify_platform((select id from creator_platforms where handle='kingclips'), true);

-- ── Phase 6: performance ──
select pg_temp.act('00000000-0000-0000-0000-0000000000c1');
select count(*) as days_expect_30, sum(qualified_gain) as q_gain, sum(earned) as earned from my_daily_performance(30, 'Asia/Makassar');
select title, posts, approved_posts, raw_views, qualified_views, earned, engagements, gain_7d from my_campaign_performance();
select count(*) as bad_tz_falls_back from my_daily_performance(7, 'Not/AZone');
select pg_temp.act('00000000-0000-0000-0000-0000000000c2');
select count(*) as c2_campaigns_expect_0 from my_campaign_performance();

-- ── Phase 7: payouts ops + notifications ──
select pg_temp.act('00000000-0000-0000-0000-0000000000c1');
select mark_notifications_read() as marked;
select count(*) filter (where read_at is null) as unread_expect_0 from notifications;
reset role;
-- new campaign alert: brand submits, admin approves → c1 (active, finance niche, tiktok) is alerted, c2 isn't
insert into campaigns (id, brand_id, title, category, cpm, budget, status, submission_deadline)
  values ('20000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000001','Finance alert test','finance',2000,1000000,'pending_approval', now()+interval '10 days');
insert into campaign_platforms values ('20000000-0000-0000-0000-000000000009','tiktok');
set role authenticated;
select pg_temp.act('00000000-0000-0000-0000-00000000000a');
select status from admin_set_campaign_status('20000000-0000-0000-0000-000000000009','active');
reset role;
select user_id::text like '%c1' as to_c1, type, body from notifications where type = 'campaign_new' order by created_at;
set role authenticated;
select amount, status, creator_username, ledger_matches from admin_payouts;
select payouts_open from admin_queue_counts;

-- ── Phase 8: control center ──
select pg_temp.act('00000000-0000-0000-0000-00000000000a');
select id as draft_id, status from upsert_campaign_draft(null, jsonb_build_object(
  'brand_id','10000000-0000-0000-0000-000000000001','title','Draft by admin','category','crypto','content_type','podcast_clips',
  'cpm',2500,'budget',5000000,'platforms',jsonb_build_array('tiktok','youtube'),
  'guidelines_do',jsonb_build_array('Hook cepat',''),'rules',jsonb_build_array(jsonb_build_object('kind','requirement','body','9:16')))) \gset
select platforms, status from admin_campaigns where id = :'draft_id';
select title, cpm from upsert_campaign_draft(:'draft_id', jsonb_build_object('title','Draft v2','cpm',3000,'budget',5000000,'platforms',jsonb_build_array('tiktok')));
select status from submit_campaign_for_approval(:'draft_id');
select pg_temp.expect_error(format($$select upsert_campaign_draft(%L, '{"title":"x","cpm":1,"budget":1}'::jsonb)$$, :'draft_id'), 'terms_locked_after_draft');
select title from admin_update_campaign_copy(:'draft_id', '{"title":"Draft v3 (copy edit)"}'::jsonb);
select campaigns_pending, disputes_open, tickets_open from admin_queue_counts;
-- creator raises a ticket + dispute
select pg_temp.act('00000000-0000-0000-0000-0000000000c1');
insert into support_tickets (user_id, category, subject, body) values (auth.uid(), 'payout', 'Pencairan', 'Kapan dana saya masuk ya?');
insert into disputes (raised_by, submission_id, reason)
  select auth.uid(), id, 'Postingan saya masih publik, mohon dicek ulang.' from submissions where normalized_url like '%7412' limit 1;
select pg_temp.expect_error($$insert into disputes (raised_by, submission_id, reason) select auth.uid(), id, 'Duplikat keberatan untuk tes.' from submissions where normalized_url like '%7412' limit 1$$, 'duplicate key');
select pg_temp.expect_error($$select upsert_campaign_draft(null, '{"brand_id":"10000000-0000-0000-0000-000000000001","title":"x","cpm":1,"budget":1}'::jsonb)$$, 'forbidden');
select pg_temp.act('00000000-0000-0000-0000-00000000000a');
select status from admin_resolve_dispute((select id from disputes limit 1), 'under_review', null);
select pg_temp.expect_error($$select admin_resolve_dispute((select id from disputes limit 1), 'resolved', '')$$, 'reason_required');
select status, resolution from admin_resolve_dispute((select id from disputes limit 1), 'resolved', 'Sudah dicek, metrik diperbarui.');
select status, admin_reply from admin_reply_ticket((select id from support_tickets limit 1), 'Pencairan diproses 1–3 hari kerja.', 'resolved');
select action, entity_type, actor_username from admin_audit_logs order by id desc limit 3;
select platform, submissions, qualified_views from campaign_platform_breakdown('20000000-0000-0000-0000-000000000001');

-- ── Phase 9: audit coverage + product events ──
select pg_temp.act('00000000-0000-0000-0000-0000000000c1');
update creator_payout_methods set account_number = '9876543210' where creator_id = auth.uid();
select count(*) as creator_sees_events_expect_0 from product_events;
reset role;
select action, after->>'account_last4' as last4, after ? 'account_number' as leaked_expect_f from audit_logs where entity_type = 'creator_payout_methods' order by id desc limit 1;
update profiles set role = 'brand' where id = '00000000-0000-0000-0000-0000000000c2';
select action, before->>'role' as before, after->>'role' as after from audit_logs where action = 'profiles.update' order by id desc limit 1;
select event, count(*) from product_events group by event order by event;
set role authenticated;
select pg_temp.act('00000000-0000-0000-0000-00000000000a');
select signed_up, onboarded, approved, joined_campaign, submitted, approved_submission, earned, paid_out from admin_creator_funnel;
select count(*) > 0 as admin_sees_events from product_events;

-- ── Brand portal ──
reset role;
insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-0000000000b2','Owner@Ruangcuan.id', null);
set role authenticated;
select pg_temp.act('00000000-0000-0000-0000-00000000000a');
select email, role from admin_invite_brand_member('10000000-0000-0000-0000-000000000001', 'owner@ruangcuan.id', 'owner');
select kind, email from admin_brand_people('10000000-0000-0000-0000-000000000001') order by kind;
select pg_temp.act('00000000-0000-0000-0000-0000000000b2');
select claim_brand_invites() as claimed_unverified_expect_0;
reset role; update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-0000000000b2'; set role authenticated;
select claim_brand_invites() as claimed_expect_1;
select role from profiles where id = auth.uid();
select name, role from my_brands();
select title, status, spent, approved, qualified_views from brand_campaigns();
select title, raw_views, qualified_views, pending_views, excluded_views, spent, platform_fee, total_cost, effective_cpm, cpm from brand_campaigns();
do $$ declare r record; begin
  for r in select * from brand_campaigns() loop
    if r.raw_views < r.qualified_views + r.pending_views and r.excluded_views <> 0 then raise exception 'views breakdown inconsistent'; end if;
    if r.excluded_views <> greatest(r.raw_views - r.qualified_views - r.pending_views, 0) then raise exception 'excluded wrong'; end if;
    if r.platform_fee <> round(r.spent * platform_fee_pct() / 100) or r.total_cost <> r.spent + r.platform_fee then raise exception 'fee wrong'; end if;
    if r.fee_pct <> 0 or r.total_cost <> r.spent then raise exception 'brand price is all-in (no separate fee)'; end if;
    if r.raw_views > 0 and r.effective_cpm <> round(r.spent * 1000.0 / r.raw_views) then raise exception 'effective cpm wrong'; end if;
  end loop;
end $$;
select daily_report as daily_on_default from my_brands();
select set_brand_daily_report('10000000-0000-0000-0000-000000000001', false);
select daily_report as daily_off_expect_f from my_brands();
select set_brand_daily_report('10000000-0000-0000-0000-000000000001', true);
select sum(qualified_gain) as q, sum(spend) as spend from brand_daily(null, 30, 'Asia/Makassar');
select creator_username, qualified_views, spend from brand_top_clips('20000000-0000-0000-0000-000000000001');
select pg_temp.expect_error($$select brand_top_clips(gen_random_uuid())$$, 'forbidden');
select pg_temp.expect_error($$select join_campaign('20000000-0000-0000-0000-000000000003')$$, 'creator_not_eligible');
select pg_temp.act('00000000-0000-0000-0000-0000000000c1');
select count(*) as creator_sees_brand_campaigns_expect_0 from brand_campaigns();
select pg_temp.expect_error($$select admin_invite_brand_member('10000000-0000-0000-0000-000000000001','x@y.id')$$, 'forbidden');

-- ── Login verification pre-request ──
reset role;
select public.login_policy() as policy_off;
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","amr":[{"method":"password","timestamp":1}]}', false);
select public.check_request() as off_password_ok;
reset role; update app_settings set value = 'true'::jsonb where key = 'require_login_otp'; set role authenticated;
select pg_temp.expect_error($$select public.check_request()$$, 'login_verification_required');
select set_config('request.jwt.claims', '{"role":"authenticated","amr":[{"method":"otp","timestamp":1}]}', false);
select public.check_request() as on_otp_ok;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select public.check_request() as anon_ok;
reset role; update app_settings set value = 'false'::jsonb where key = 'require_login_otp';
select public.login_policy() as policy_back_off;

-- ── Admin allowlist ──
reset role;
insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-0000000000ad', 'TappCreators@gmail.com', null);
select role as before_verify from profiles where id = '00000000-0000-0000-0000-0000000000ad';
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-0000000000ad';
select role as after_verify_expect_admin from profiles where id = '00000000-0000-0000-0000-0000000000ad';
insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-0000000000ae', 'someone@else.id', now());
select role as other_expect_creator from profiles where id = '00000000-0000-0000-0000-0000000000ae';

-- ── Tier system: c1's one submission was re-qualified to 300000 (qualified_views is the submission's
-- latest value, not additive across re-qualifications) — lands in 'verified' (250k–1m) ──
select tier, lifetime_qualified_views from creator_profiles cp, lateral (select public.lifetime_qualified_views(cp.user_id)) lv(lifetime_qualified_views)
  where user_id = '00000000-0000-0000-0000-0000000000c1';   -- expect verified / 300000
select tier_for_views(0) as t0, tier_for_views(49999) as t1, tier_for_views(50000) as t2,
  tier_for_views(999999) as t3, tier_for_views(1000000) as t4, tier_for_views(99000000) as t5;
  -- expect new, new, rising, verified, proven, elite
select pg_temp.act('00000000-0000-0000-0000-0000000000c1');
select tier, next_tier, views_to_next from my_tier_progress() q, lateral jsonb_to_record(q) as x(tier text, next_tier text, views_to_next bigint);
  -- expect verified / proven / 700000
reset role;

-- ── Auto-record foundation ──
-- connect_platform_account is no longer client-callable (0031: tokens only arrive via the server-side OAuth
-- exchange); exercise the rest of the surface with a connection row inserted directly.
select pg_temp.act('00000000-0000-0000-0000-0000000000c1'); set role authenticated;
select pg_temp.expect_error($$select connect_platform_account('tiktok','pu123','kingclips','tok_abc','ref_abc',3600,array['video.list'])$$, 'permission denied');
reset role;
insert into creator_platform_connections (creator_id, platform, platform_user_id, handle, status)
  values ('00000000-0000-0000-0000-0000000000c1', 'tiktok', 'pu123', 'kingclips', 'connected');
select pg_temp.act('00000000-0000-0000-0000-0000000000c1'); set role authenticated;
select platform, handle, status from my_platform_connections();                 -- expect tiktok / kingclips / connected
select count(*) as other_creators_rows_expect_0 from creator_platform_connections where creator_id <> auth.uid();  -- RLS hides them, no error
select pg_temp.expect_error($$insert into creator_platform_connections (creator_id, platform, platform_user_id) values (auth.uid(),'youtube','x')$$, 'permission denied');
-- service_role-only surface: a plain authenticated session must not see these.
select pg_temp.expect_error($$select * from due_for_auto_metrics()$$, 'permission denied');
select pg_temp.expect_error($$select get_platform_token(gen_random_uuid())$$, 'permission denied');
select pg_temp.expect_error(format($$select record_api_metrics(%L, 123)$$, :'sub_id'), 'permission denied');
reset role;
-- due_for_auto_metrics excludes it right now: admin_qualify_views above already set last_metrics_at = now()
-- (well inside the 180-minute cooldown). Back-date it to prove the function picks up a genuinely due submission.
update submissions set last_metrics_at = now() - interval '4 hours' where id = :'sub_id';
select submission_id, platform, platform_user_id from due_for_auto_metrics() where submission_id = :'sub_id';  -- expect 1 row now
select views, source from record_api_metrics(:'sub_id', 777777);
select views, source from content_metrics where submission_id = :'sub_id' order by created_at desc limit 1;  -- expect 777777 / api
select pg_temp.act('00000000-0000-0000-0000-0000000000c1'); set role authenticated;
select pg_temp.expect_error($$select disconnect_platform_account('instagram')$$, 'not_connected');
select disconnect_platform_account('tiktok');
select status from creator_platform_connections where creator_id = '00000000-0000-0000-0000-0000000000c1' and platform = 'tiktok';  -- expect revoked
reset role;
select count(*) as due_after_disconnect_expect_0 from due_for_auto_metrics();

-- ── Reliability score (0025) ──
reset role;
select user_id, reliability_score,
  (select count(*) from submissions s where s.creator_id = cp.user_id and s.status in ('approved','tracking','completed','rejected','flagged')) as reviewed
from creator_profiles cp order by user_id;
do $$ begin
  if exists (select 1 from creator_profiles cp where reliability_score <> case
      when (select count(*) from submissions s where s.creator_id = cp.user_id and s.status in ('approved','tracking','completed','rejected','flagged')) = 0 then 0
      else round(100.0 * ((select count(*) from submissions s where s.creator_id = cp.user_id and s.status in ('approved','tracking','completed') and s.content_state not in ('deleted','private')) + 1)
        / ((select count(*) from submissions s where s.creator_id = cp.user_id and s.status in ('approved','tracking','completed','rejected','flagged')) + 2), 2) end)
  then raise exception 'reliability_score out of sync'; end if;
  if not exists (select 1 from creator_profiles where reliability_score > 0) then raise exception 'reliability never computed'; end if;
end $$;
select 'reliability_ok' as result;

-- ── Admin MFA (0026) ──
reset role; update app_settings set value = 'true'::jsonb where key = 'require_admin_mfa'; set role authenticated;
select pg_temp.act('00000000-0000-0000-0000-00000000000a');
select set_config('request.jwt.claims', '{"role":"authenticated","aal":"aal1"}', false);
select is_admin() as aal1_admin_expect_false;
select count(*) as aal1_sees_audit_expect_0 from audit_logs;
select pg_temp.expect_error($$select admin_set_creator_status('00000000-0000-0000-0000-0000000000c2','suspended','x')$$, 'forbidden');
select set_config('request.jwt.claims', '{"role":"authenticated","aal":"aal2"}', false);
select is_admin() as aal2_admin_expect_true;
do $$ begin if not public.is_admin() then raise exception 'aal2 admin rejected'; end if;
  if (select count(*) from audit_logs) = 0 then raise exception 'aal2 admin cannot read audit'; end if; end $$;
select pg_temp.act('00000000-0000-0000-0000-0000000000c1');
select is_admin() as creator_aal2_expect_false;
select set_config('request.jwt.claims', '', false);
reset role;
select 'admin_mfa_ok' as result;

-- ── YouTube auto metrics queue (0027) ──
reset role;
select substring('youtube.com/watch/dQw4w9WgXcQ' from '^youtube\.com/watch/([A-Za-z0-9_-]+)$') as yt_id_expect_dQw4w9WgXcQ;
select count(*) >= 0 as yt_queue_runs from due_for_youtube_metrics();
set role authenticated;
select pg_temp.expect_error($$select * from due_for_youtube_metrics()$$, 'permission denied');
reset role;
select 'youtube_queue_ok' as result;

-- ── Meeting booking (0028) ──
reset role;
update app_settings set value = 'false'::jsonb where key = 'require_admin_mfa';
create temp table _slot as
  select ((d + time '10:00') at time zone 'Asia/Jakarta') as s1, ((d + time '10:30') at time zone 'Asia/Jakarta') as s2,
         ((d + time '10:30') at time zone 'Asia/Jakarta') + interval '1 day' as s3, ((d + time '18:00') at time zone 'Asia/Jakarta') as bad
  from (select min(x)::date as d from generate_series(current_date + 2, current_date + 9, interval '1 day') x where extract(isodow from x) between 1 and 3) q;
grant select on _slot to anon, authenticated;
set role anon;
select (request_meeting('Budi Brand', 'Acme Kopi', 'Budi@Acme.id', (select s1 from _slot), '+62 812 3456 7890', 'Launching produk', '10-50jt'))->>'slot' is not null as booked;
select count(*) as taken_expect_1 from meeting_slots_taken();
select pg_temp.expect_error($$select request_meeting('Ani', 'Other Co', 'ani@other.id', (select s1 from _slot))$$, 'meeting_slot_taken');
select pg_temp.expect_error($$select request_meeting('Ani', 'Other Co', 'ani@other.id', (select bad from _slot))$$, 'meeting_slot_invalid');
select pg_temp.expect_error($$select request_meeting('Ani', 'Other Co', 'ani@other.id', now() + interval '1 hour')$$, 'meeting_slot');
select request_meeting('Budi Brand', 'Acme Kopi', 'budi@acme.id', (select s2 from _slot)) is not null as second_ok;
select pg_temp.expect_error($$select request_meeting('Budi Brand', 'Acme Kopi', 'budi@acme.id', (select s3 from _slot))$$, 'meeting_too_many_open');
select pg_temp.expect_error($$select * from meeting_requests$$, 'permission denied');
reset role; set role authenticated;
select pg_temp.act('00000000-0000-0000-0000-0000000000c1');
select count(*) as creator_sees_expect_0 from meeting_requests;
select pg_temp.expect_error($$select admin_update_meeting((select id from meeting_requests limit 1), 'done')$$, 'forbidden');
reset role;
do $$ declare v uuid; begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
  select id into v from meeting_requests where slot = (select s1 from _slot);
  begin perform admin_update_meeting(v, 'scheduled'); raise exception 'expected meeting_link_required';
  exception when others then if sqlerrm not like 'meeting_link_required%' then raise; end if; end;
  perform admin_update_meeting(v, 'scheduled', 'https://meet.google.com/abc-defg-hij', 'Kickoff');
  if (select status from meeting_requests where id = v) <> 'scheduled' then raise exception 'not scheduled'; end if;
  perform admin_update_meeting(v, 'cancelled');
end $$;
set role anon;
select count(*) as taken_after_cancel_expect_1 from meeting_slots_taken();
reset role;
select 'meeting_booking_ok' as result;

-- ── Brand daily report (0029) ──
reset role;
select send_brand_daily_reports() >= 0 as daily_report_runs;
set role authenticated;
select pg_temp.expect_error($$select send_brand_daily_reports()$$, 'permission denied');
reset role;
select 'brand_reporting_ok' as result;

-- ── Automatic view filtering (0030) ──
reset role;
update app_settings set value = jsonb_set(value, '{enabled}', 'true') where key = 'auto_qualify';   -- off by default since 0035
create temp table _aq as select id, creator_id, platform, qualified_views from submissions where status = 'tracking' order by created_at limit 1;
update creator_profiles set status = 'active' where user_id = (select creator_id from _aq);
update creator_platforms set verified_at = now(), followers = 1000000 where creator_id = (select creator_id from _aq) and platform = (select platform from _aq);
update submissions set content_state = 'live' where id = (select id from _aq);
-- clean growth: +20% over the last snapshot, healthy engagement → qualified automatically at raw views
insert into content_metrics (submission_id, captured_at, views, likes, comments, shares, saves, source)
select id, now(), (select max(views) from content_metrics where submission_id = _aq.id) * 12 / 10, 9000, 400, 300, 100, 'manual' from _aq;
select (auto_qualify_sweep()).qualified >= 1 as auto_qualified_some;
do $$ declare v_raw bigint; v_q bigint; v_by uuid; begin
  select m.views into v_raw from content_metrics m where m.submission_id = (select id from _aq) order by captured_at desc limit 1;
  select qualified_views into v_q from submissions where id = (select id from _aq);
  select computed_by into v_by from performance_snapshots where submission_id = (select id from _aq) order by created_at desc limit 1;
  if v_q <> v_raw then raise exception 'auto qualify expected % got %', v_raw, v_q; end if;
  if v_by is not null then raise exception 'auto snapshot should have computed_by null'; end if;
end $$;
-- suspicious: 20× jump within an hour and almost no engagement → held with reasons, nothing paid
insert into content_metrics (submission_id, captured_at, views, likes, comments, shares, saves, source)
select id, now() + interval '1 hour', (select views from content_metrics where submission_id = _aq.id order by captured_at desc limit 1) * 20, 10, 0, 0, 0, 'manual' from _aq;
select (auto_qualify_sweep()).held >= 1 as held_some;
select auto_hold_reason from submissions where id = (select id from _aq);
do $$ begin
  if (select auto_hold_reason from submissions where id = (select id from _aq)) not like '%naik%' then raise exception 'jump not detected'; end if;
  if (select auto_hold_reason from submissions where id = (select id from _aq)) not like '%engagement rendah%' then raise exception 'engagement not detected'; end if;
  if (select auto_held from admin_queue_counts) < 1 then raise exception 'held count missing'; end if;
end $$;
-- a held clip is not re-examined until a new metric arrives; switching the feature off stops the sweep
select (auto_qualify_sweep()).held = 0 as not_rechecked;
update app_settings set value = jsonb_set(value, '{enabled}', 'false') where key = 'auto_qualify';
select (auto_qualify_sweep()).qualified = 0 as off_does_nothing;
update app_settings set value = jsonb_set(value, '{enabled}', 'true') where key = 'auto_qualify';
set role authenticated;
select pg_temp.expect_error($$select auto_qualify_sweep()$$, 'permission denied');
reset role;
select 'auto_qualify_ok' as result;

-- ── TikTok connect (0031) ──
reset role;
set role authenticated;
select pg_temp.act('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_error($$select oauth_complete_tiktok(auth.uid(),'pu123','kingclips',100,'a','r',86400,array['video.list'])$$, 'permission denied');
select pg_temp.expect_error($$select * from due_for_tiktok_metrics()$$, 'permission denied');
select pg_temp.expect_error($$select * from oauth_states$$, 'permission denied');
reset role;
-- another creator logging in with an account already registered to c1 is refused
select pg_temp.expect_error($$select oauth_complete_tiktok('00000000-0000-0000-0000-0000000000c2','pu999','KingClips',5,'a','r',86400,null)$$, 'tiktok_account_taken');
-- the owner logging in: connection back to connected, account verified, followers stored
update creator_platforms set verified_at = null where creator_id = '00000000-0000-0000-0000-0000000000c1' and platform = 'tiktok';
select handle, followers, verified_at is not null as verified_expect_t
  from oauth_complete_tiktok('00000000-0000-0000-0000-0000000000c1','pu123','@KingClips',4321,'a','r',86400,array['video.list']);
do $$ begin
  if (select status from creator_platform_connections where creator_id = '00000000-0000-0000-0000-0000000000c1' and platform = 'tiktok') <> 'connected'
    then raise exception 'connection not restored'; end if;
  if (select count(*) from creator_platforms where creator_id = '00000000-0000-0000-0000-0000000000c1' and platform = 'tiktok') <> 1
    then raise exception 'duplicate tiktok row'; end if;
  if not exists (select 1 from notifications where user_id = '00000000-0000-0000-0000-0000000000c1' and title = 'Akun TikTok terverifikasi')
    then raise exception 'no notification'; end if;
end $$;
-- a different open_id already connected elsewhere is refused even under a new username
select pg_temp.expect_error($$select oauth_complete_tiktok('00000000-0000-0000-0000-0000000000c2','pu123','another_name',5,'a','r',86400,null)$$, 'tiktok_account_taken');
-- queue: c1's tracking TikTok clip with a video id, once its cooldown has passed
update submissions set last_metrics_at = now() - interval '4 hours' where id = :'sub_id';
select video_id from due_for_tiktok_metrics() where submission_id = :'sub_id';   -- expect 7412
do $$ begin
  if not exists (select 1 from due_for_tiktok_metrics() where video_id = '7412') then raise exception 'tiktok queue missed clip'; end if;
end $$;
select 'tiktok_connect_ok' as result;

-- ── Admin connections (0032) ──
reset role;
set role authenticated;
select pg_temp.act('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_error($$select * from admin_platform_connections()$$, 'forbidden');
select pg_temp.expect_error($$select admin_disconnect_platform(gen_random_uuid(), 'x')$$, 'forbidden');
select pg_temp.act('00000000-0000-0000-0000-00000000000a');
select platform, handle, status, verified as verified_expect_t, tracked >= 1 as tracked_expect_t
  from admin_platform_connections(null, 'kingclips');
select pg_temp.expect_error($$select admin_disconnect_platform((select id from admin_platform_connections(null,'kingclips') limit 1), '  ')$$, 'reason_required');
select admin_disconnect_platform((select id from admin_platform_connections(null, 'kingclips') limit 1), 'Akun dipakai bersama', true);
select pg_temp.expect_error($$select admin_disconnect_platform((select id from admin_platform_connections(null,'kingclips') limit 1), 'lagi')$$, 'already_disconnected');
reset role;
do $$ begin
  if (select status from creator_platform_connections where creator_id = '00000000-0000-0000-0000-0000000000c1' and platform = 'tiktok') <> 'revoked'
    then raise exception 'not revoked'; end if;
  if exists (select 1 from creator_platforms where creator_id = '00000000-0000-0000-0000-0000000000c1' and platform = 'tiktok' and verified_at is not null)
    then raise exception 'still verified'; end if;
  if not exists (select 1 from notifications where user_id = '00000000-0000-0000-0000-0000000000c1' and type = 'platform_disconnected')
    then raise exception 'creator not told'; end if;
  if not exists (select 1 from audit_logs where action = 'admin.platform_disconnected') then raise exception 'no audit'; end if;
  if exists (select 1 from due_for_tiktok_metrics() where video_id = '7412') then raise exception 'revoked still queued'; end if;
end $$;
select 'admin_connections_ok' as result;

-- ── Instagram connect (0033) ──
reset role;
set role authenticated;
select pg_temp.act('00000000-0000-0000-0000-0000000000c2');
select pg_temp.expect_error($$select oauth_complete_instagram(auth.uid(),'ig1','c2.ig',10,'a',5184000,null)$$, 'permission denied');
select pg_temp.expect_error($$select oauth_complete_account(auth.uid(),'instagram','ig1','c2.ig',10,'a',null,5184000,null)$$, 'permission denied');
select pg_temp.expect_error($$select * from due_for_instagram_metrics()$$, 'permission denied');
reset role;
select handle, profile_url, followers, verified_at is not null as verified_expect_t
  from oauth_complete_instagram('00000000-0000-0000-0000-0000000000c2', 'ig1', '@C2.IG', 5400, 'tok', 5184000, array['instagram_business_basic']);
select pg_temp.expect_error($$select oauth_complete_instagram('00000000-0000-0000-0000-0000000000c1','ig9','c2.ig',1,'t',5184000,null)$$, 'instagram_account_taken');
select pg_temp.expect_error($$select oauth_complete_instagram('00000000-0000-0000-0000-0000000000c1','ig1','other.name',1,'t',5184000,null)$$, 'instagram_account_taken');
do $$ begin
  if (select profile_url from creator_platforms where creator_id = '00000000-0000-0000-0000-0000000000c2' and platform = 'instagram') <> 'https://www.instagram.com/c2.ig'
    then raise exception 'instagram profile url'; end if;
  if not exists (select 1 from notifications where user_id = '00000000-0000-0000-0000-0000000000c2' and title = 'Akun Instagram terverifikasi')
    then raise exception 'instagram notification'; end if;
  if (select status from creator_platform_connections where creator_id = '00000000-0000-0000-0000-0000000000c2' and platform = 'instagram') <> 'connected'
    then raise exception 'instagram not connected'; end if;
end $$;
select substring('instagram.com/reel/AbC_123' from '^instagram\.com/(?:p|reel|tv)/([A-Za-z0-9_-]+)') as shortcode_expect_AbC_123;
select count(*) >= 0 as ig_queue_runs from due_for_instagram_metrics();
select 'instagram_connect_ok' as result;

-- ── Withdrawal fee by tier (0034) ──
reset role;
select withdrawal_fee_pct('new') as new_5, withdrawal_fee_pct('rising') as rising_4, withdrawal_fee_pct('verified') as verified_3,
       withdrawal_fee_pct('proven') as proven_2, withdrawal_fee_pct('elite') as elite_0;
do $$ declare p public.payout_requests; begin
  select * into p from payout_requests where status = 'paid' order by created_at limit 1;
  if p.fee_tier is null then raise exception 'fee tier not recorded'; end if;
  if p.fee <> round(p.amount * 0.18) + 10000 or p.fee_pct <> 18 then raise exception 'creator fee expected, got % (% pct)', p.fee, p.fee_pct; end if;
  if p.net_amount <> p.amount + p.bonus - p.fee then raise exception 'net mismatch'; end if;
  if p.bonus <> round(p.amount * tier_bonus_pct(p.fee_tier) / 100) or p.bonus_pct <> tier_bonus_pct(p.fee_tier) then raise exception 'bonus % pct % tier %', p.bonus, p.bonus_pct, p.fee_tier; end if;
  if tier_bonus_pct('elite') <= tier_bonus_pct('new') then raise exception 'higher tier should earn more'; end if;
  if (select paid from campaigns where id = '20000000-0000-0000-0000-000000000001') <> 600000 then raise exception 'bonus must not touch the campaign budget'; end if;
end $$;
select amount, fee, fee_pct, net_amount from admin_payouts limit 1;
select 'withdrawal_fee_ok' as result;

-- ── Campaign banner (0036) ──
set role authenticated;
select pg_temp.act('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_error($$select admin_set_campaign_banner('20000000-0000-0000-0000-000000000001', 'https://x.supabase.co/b.jpg')$$, 'forbidden');
select pg_temp.act('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error($$select admin_set_campaign_banner('20000000-0000-0000-0000-000000000001', 'http://insecure/b.jpg')$$, 'invalid_banner_url');
select banner_url from admin_set_campaign_banner('20000000-0000-0000-0000-000000000001', 'https://x.supabase.co/storage/v1/object/public/campaign-banners/b.jpg');
reset role;
do $$ begin
  if (select banner_url from campaigns where id = '20000000-0000-0000-0000-000000000001') is null then raise exception 'banner not saved'; end if;
end $$;
select count(*) >= 0 as public_list_has_banner_column from public_campaigns() where banner_url is not null or banner_url is null;
select 'campaign_banner_ok' as result;

-- ── Bio code verification (0039) ──
reset role;
insert into creator_platforms (creator_id, platform, handle) values ('00000000-0000-0000-0000-0000000000c2', 'instagram', 'bio.test.ig');
set role authenticated;
select pg_temp.act('00000000-0000-0000-0000-0000000000c2');
select (bio_code_issue((select id from creator_platforms where handle = 'bio.test.ig')))->>'code' ~ '^TAPP-[A-Z2-9]{6}$' as code_ok;
select (bio_code_issue((select id from creator_platforms where handle = 'bio.test.ig')))->>'code' = (select bio_code from creator_platforms where handle = 'bio.test.ig') as reused;
select pg_temp.act('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_error($$select bio_code_issue((select id from creator_platforms where handle = 'bio.test.ig'))$$, 'platform_not_found');
reset role;
select bio_code_result((select id from creator_platforms where handle = 'bio.test.ig'), 'unreadable', 'blocked');
select count(*) = 1 as queued from admin_bio_reviews where handle = 'bio.test.ig';
set role authenticated;
select pg_temp.act('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error($$select admin_review_bio((select id from creator_platforms where handle = 'bio.test.ig'), false)$$, 'reason_required');
select admin_review_bio((select id from creator_platforms where handle = 'bio.test.ig'), true);
reset role;
do $$ begin
  if (select verified_at from creator_platforms where handle = 'bio.test.ig') is null then raise exception 'bio verify failed'; end if;
  if (select bio_status from creator_platforms where handle = 'bio.test.ig') <> 'verified' then raise exception 'bio status'; end if;
end $$;
select 'bio_code_ok' as result;

-- ── Campaign participation on cards (0040) ──
reset role;
do $$ declare r record; begin
  select * into r from campaign_participation(array['20000000-0000-0000-0000-000000000001'::uuid]);
  if r.creators_joined <> (select count(*) from campaign_creators where campaign_id = '20000000-0000-0000-0000-000000000001' and status = 'joined') then raise exception 'joined count'; end if;
  if r.creators_joined > 0 and coalesce(array_length(r.initials, 1), 0) = 0 then raise exception 'initials missing'; end if;
end $$;
set role anon;
select count(*) >= 0 as anon_reads_participation from campaign_participation(array['20000000-0000-0000-0000-000000000001'::uuid]);
select count(*) >= 0 as anon_public_list from public_campaigns() where creators_joined >= 0;
reset role;
select private.initials('Rani Putri', 'rani') = 'RP' and private.initials(null, 'budi.s') = 'BU' as initials_ok;
select 'participation_ok' as result;

-- ── Automatic submission check (0041) ──
reset role;
insert into submission_checks (submission_id, status, author, views)
select id, 'ok', 'rani', 12345 from submissions where creator_id = '00000000-0000-0000-0000-0000000000c1' order by created_at limit 1;
set role authenticated;
select pg_temp.act('00000000-0000-0000-0000-0000000000c1');
select count(*) = 1 as owner_sees_check from submission_checks;
select pg_temp.expect_error($$insert into submission_checks (submission_id, status) select id, 'ok' from submissions limit 1$$, 'permission denied');
select pg_temp.act('00000000-0000-0000-0000-0000000000c2');
select count(*) = 0 as other_creator_sees_nothing from submission_checks;
select pg_temp.act('00000000-0000-0000-0000-00000000000a');
select count(*) = 1 as admin_sees_check from submission_checks;
reset role;
select 'submission_check_ok' as result;

-- ── Views history + sweep selection (0042) ──
reset role;
insert into submission_check_log (submission_id, status, views, likes)
select submission_id, 'ok', 12345, 400 from submission_checks limit 1;
set role authenticated;
select pg_temp.act('00000000-0000-0000-0000-0000000000c1');
select count(*) = 1 as owner_sees_log from submission_check_log;
select pg_temp.expect_error($$select due_submission_checks(5)$$, 'permission denied');
select pg_temp.act('00000000-0000-0000-0000-0000000000c2');
select count(*) = 0 as other_sees_no_log from submission_check_log;
reset role;
select count(*) >= 0 as due_list_runs from due_submission_checks(5);
select 'check_log_ok' as result;

-- ── Campaign hashtag reach (0043) ──
set role authenticated;
select pg_temp.act('00000000-0000-0000-0000-00000000000a');
select hashtag = 'TAPPKopiSenja' as hashtag_saved from admin_set_campaign_hashtag('20000000-0000-0000-0000-000000000001', ' #TAPPKopiSenja ');
select pg_temp.expect_error($$select admin_set_campaign_hashtag('20000000-0000-0000-0000-000000000001', 'bad-tag!')$$, 'invalid_hashtag');
select pg_temp.act('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_error($$select admin_set_campaign_hashtag('20000000-0000-0000-0000-000000000001', 'x1')$$, '');
reset role;
insert into campaign_hashtag_stats (campaign_id, hashtag, video_count, view_count) values ('20000000-0000-0000-0000-000000000001', 'TAPPKopiSenja', 12, 34000);
set role authenticated;
select pg_temp.act('00000000-0000-0000-0000-00000000000b');
select count(*) = 1 as brand_sees_hashtag from campaign_hashtag_stats;
select pg_temp.act('00000000-0000-0000-0000-0000000000c1');
select count(*) = 0 as creator_sees_no_hashtag from campaign_hashtag_stats;
reset role;
select 'hashtag_ok' as result;

-- ── Raw views from automatic checks (0044) ──
reset role;
do $$ declare v_sub uuid; v_before bigint; v_after bigint; v_status public.submission_status; begin
  select id, status into v_sub, v_status from submissions where status not in ('rejected', 'needs_changes') order by created_at limit 1;
  select count(*) into v_before from content_metrics where submission_id = v_sub;
  perform record_check_metrics(v_sub, 77777, 900, 40, 10);
  select count(*) into v_after from content_metrics where submission_id = v_sub;
  if v_after <> v_before + 1 then raise exception 'check metric not stored'; end if;
  if not exists (select 1 from content_metrics where submission_id = v_sub and views = 77777 and source = 'api') then raise exception 'wrong views'; end if;
  if (select status from submissions where id = v_sub) <> v_status then raise exception 'status changed'; end if;
end $$;
set role authenticated;
select pg_temp.act('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_error($$select record_check_metrics(gen_random_uuid(), 1, 0, 0, 0)$$, 'permission denied');
reset role;
select 'raw_from_checks_ok' as result;

-- ── Brand price vs creator rate (0045) ──
reset role;
update app_settings set value = '70'::jsonb where key = 'creator_share_pct';
set role authenticated;
select pg_temp.act('00000000-0000-0000-0000-00000000000a');
select id as priced_id from upsert_campaign_draft(null, jsonb_build_object(
  'brand_id','10000000-0000-0000-0000-000000000001','title','Priced','cpm',1500,'budget',1000000,'platforms',jsonb_build_array('tiktok'))) \gset
do $$ declare a record; begin
  select * into a from admin_campaigns where title = 'Priced';
  if a.brand_cpm <> 1500 or a.cpm <> 1050 or a.creator_share_pct <> 70 then raise exception 'creator rate should be 70%%: % / %', a.cpm, a.brand_cpm; end if;
  if a.brand_budget <> 1000000 or a.budget <> 700000 then raise exception 'creator budget wrong: %', a.budget; end if;
end $$;
select cpm from upsert_campaign_draft(:'priced_id', jsonb_build_object('title','Priced','cpm',2000,'budget',1000000,'creator_share_pct',100)); -- admin override
select cpm as override_expect_2000 from campaigns where id = :'priced_id';
select pg_temp.act('00000000-0000-0000-0000-0000000000c1');
select count(*) as creator_reads_pricing_expect_0 from campaign_pricing;
select pg_temp.act('00000000-0000-0000-0000-00000000000b');
select count(*) > 0 as brand_reads_own_pricing from campaign_pricing;
reset role;
select private.brand_amount(1050, 70) as brand_money_expect_1500;
select 'brand_pricing_ok' as result;

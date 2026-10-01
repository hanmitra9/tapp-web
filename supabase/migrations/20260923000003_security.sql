-- TAPP · 0003 · Authorization
-- Model: deny by default. Clients read through RLS; sensitive writes only via SECURITY DEFINER RPCs.
-- Column-level grants stop creators from writing status, tier, scores, budgets, earnings, or roles.

set search_path = public, extensions;

-- ─────────────────────────────── Reset default grants ────────────────
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;


-- ─────────────────────────────── Policy helpers ──────────────────────
-- SECURITY DEFINER lookups keep policies non-recursive (campaigns ↔ memberships ↔ submissions) and fast.
create or replace function public.is_campaign_member(p_campaign uuid, p_joined_only boolean default false) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.campaign_creators where campaign_id = p_campaign and creator_id = auth.uid()
                 and (not p_joined_only or status = 'joined'))
$$;
create or replace function public.campaign_brand_id(p_campaign uuid) returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select brand_id from public.campaigns where id = p_campaign
$$;
create or replace function public.campaign_status_of(p_campaign uuid) returns public.campaign_status
language sql stable security definer set search_path = public, extensions as $$
  select status from public.campaigns where id = p_campaign
$$;
create or replace function public.can_manage_campaign(p_campaign uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select public.is_admin() or public.is_brand_member(public.campaign_brand_id(p_campaign))
$$;
create or replace function public.can_view_campaign(p_campaign uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select public.campaign_status_of(p_campaign) = 'active' or public.is_campaign_member(p_campaign) or public.can_manage_campaign(p_campaign)
$$;
create or replace function public.can_view_submission(p_submission uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.submissions s where s.id = p_submission
                 and (s.creator_id = auth.uid() or public.can_manage_campaign(s.campaign_id)))
$$;
create or replace function public.brand_can_see_creator(p_creator uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.submissions s join public.brand_members bm on bm.brand_id = public.campaign_brand_id(s.campaign_id)
                 where s.creator_id = p_creator and bm.user_id = auth.uid())
$$;
grant execute on function public.is_campaign_member(uuid,boolean), public.campaign_brand_id(uuid), public.campaign_status_of(uuid),
  public.can_manage_campaign(uuid), public.can_view_campaign(uuid), public.can_view_submission(uuid), public.brand_can_see_creator(uuid)
  to authenticated;

-- ─────────────────────────────── RPC surface ─────────────────────────
grant execute on function
  public.is_admin(), public.is_brand_member(uuid), public.normalize_post_url(text), public.format_idr(bigint),
  public.complete_creator_onboarding(text,text,text,public.platform,text[],text[],text,jsonb,text),
  public.join_campaign(uuid), public.leave_campaign(uuid),
  public.submit_content(uuid,public.platform,text,timestamptz,text,text),
  public.request_payout(uuid),
  public.submit_campaign_for_approval(uuid),
  -- admin RPCs self-check is_admin(); granted so the admin console can call them with a user JWT
  public.admin_review_submission(uuid,public.submission_status,text),
  public.admin_record_metrics(uuid,bigint,bigint,bigint,bigint,bigint,timestamptz,public.metric_source,public.content_state,jsonb),
  public.admin_qualify_views(uuid,uuid,bigint,text,boolean),
  public.admin_update_payout(uuid,public.payout_status,text,text),
  public.admin_set_creator_status(uuid,public.creator_status,text),
  public.admin_set_campaign_status(uuid,public.campaign_status,text),
  public.admin_adjust_campaign_budget(uuid,bigint,boolean,text)
to authenticated;
grant execute on function public.release_matured_earnings(uuid) to service_role;   -- cron only

-- ─────────────────────────────── Settings ────────────────────────────
grant select on public.app_settings to authenticated;
create policy app_settings_read on public.app_settings for select to authenticated using (true);

-- ─────────────────────────────── Profiles ────────────────────────────
grant select on public.profiles to authenticated;
grant update (full_name, username, avatar_url, country) on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid() or public.is_admin() or public.brand_can_see_creator(id));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

grant select on public.creator_profiles to authenticated;
grant update (main_platform, niches, content_categories, content_style, audience, experience_level)
  on public.creator_profiles to authenticated;
create policy creator_profiles_select on public.creator_profiles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy creator_profiles_update_own on public.creator_profiles for update to authenticated
  using (user_id = auth.uid() and status not in ('suspended','banned')) with check (user_id = auth.uid());

grant select, delete on public.creator_platforms to authenticated;
grant insert (creator_id, platform, handle, profile_url, followers, is_primary) on public.creator_platforms to authenticated;
grant update (profile_url, followers, is_primary) on public.creator_platforms to authenticated;
create policy creator_platforms_select on public.creator_platforms for select to authenticated
  using (creator_id = auth.uid() or public.is_admin());
create policy creator_platforms_insert on public.creator_platforms for insert to authenticated with check (creator_id = auth.uid());
create policy creator_platforms_update on public.creator_platforms for update to authenticated
  using (creator_id = auth.uid()) with check (creator_id = auth.uid());
create policy creator_platforms_delete on public.creator_platforms for delete to authenticated using (
  creator_id = auth.uid() and not exists (
    select 1 from public.submissions s where s.creator_id = auth.uid() and s.platform = creator_platforms.platform
      and s.status in ('pending_review','approved','tracking','flagged')));

grant select, delete on public.creator_payout_methods to authenticated;
grant insert (creator_id, kind, provider, account_name, account_number, is_default) on public.creator_payout_methods to authenticated;
grant update (kind, provider, account_name, account_number, is_default) on public.creator_payout_methods to authenticated;
create policy payout_methods_select on public.creator_payout_methods for select to authenticated
  using (creator_id = auth.uid() or public.is_admin());
create policy payout_methods_write on public.creator_payout_methods for all to authenticated
  using (creator_id = auth.uid()) with check (creator_id = auth.uid());

-- ─────────────────────────────── Brands ──────────────────────────────
grant select on public.brands to authenticated;
grant insert, update (name, slug, logo_url, website, status) on public.brands to authenticated;
create policy brands_select on public.brands for select to authenticated
  using (status = 'active' or public.is_brand_member(id) or public.is_admin());
create policy brands_admin_insert on public.brands for insert to authenticated with check (public.is_admin());
create policy brands_admin_update on public.brands for update to authenticated using (public.is_admin());

grant select, insert, delete on public.brand_members to authenticated;
create policy brand_members_select on public.brand_members for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy brand_members_admin on public.brand_members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────── Campaigns ───────────────────────────
grant select on public.campaigns to authenticated;
grant insert (id, brand_id, title, objective, description, category, content_type, cpm, budget, max_earning_per_submission,
              min_views_to_qualify, starts_at, ends_at, submission_deadline, guidelines_do, guidelines_dont, terms, created_by)
  on public.campaigns to authenticated;
grant update (title, objective, description, category, content_type, cpm, budget, max_earning_per_submission,
              min_views_to_qualify, starts_at, ends_at, submission_deadline, guidelines_do, guidelines_dont, terms)
  on public.campaigns to authenticated;

create policy campaigns_select on public.campaigns for select to authenticated using (
  status = 'active' or public.is_campaign_member(id) or public.is_brand_member(brand_id) or public.is_admin());
create policy campaigns_insert on public.campaigns for insert to authenticated
  with check ((public.is_brand_member(brand_id) or public.is_admin()) and status = 'draft' and earned = 0 and created_by = auth.uid());
-- Commercial terms are editable only while draft; after that, budget changes go through admin_adjust_campaign_budget.
create policy campaigns_update_draft on public.campaigns for update to authenticated
  using (status = 'draft' and (public.is_brand_member(brand_id) or public.is_admin()))
  with check (status = 'draft');
create policy campaigns_update_admin_copy on public.campaigns for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- Note: admin copy edits on live campaigns still can't touch earned/paid/status (no column grant).
-- Guard cpm/budget on non-draft campaigns for everyone, admins included:
create or replace function public.guard_campaign_terms() returns trigger language plpgsql set search_path = public as $$
begin
  if old.status <> 'draft' and current_user = 'authenticated'
     and (new.cpm <> old.cpm or new.budget <> old.budget or new.min_views_to_qualify <> old.min_views_to_qualify
          or new.max_earning_per_submission is distinct from old.max_earning_per_submission) then
    raise exception 'terms_locked_after_draft';
  end if;
  return new;
end $$;
create trigger campaigns_guard_terms before update on public.campaigns for each row execute function public.guard_campaign_terms();

grant select, insert, delete on public.campaign_platforms to authenticated;
create policy campaign_platforms_select on public.campaign_platforms for select to authenticated
  using (public.can_view_campaign(campaign_id));
create policy campaign_platforms_write on public.campaign_platforms for all to authenticated
  using (public.campaign_status_of(campaign_id) = 'draft' and public.can_manage_campaign(campaign_id))
  with check (public.campaign_status_of(campaign_id) = 'draft' and public.can_manage_campaign(campaign_id));

grant select, insert, update, delete on public.campaign_rules to authenticated;
create policy campaign_rules_select on public.campaign_rules for select to authenticated
  using (public.can_view_campaign(campaign_id));
create policy campaign_rules_write on public.campaign_rules for all to authenticated
  using (public.is_admin() or (public.campaign_status_of(campaign_id) = 'draft' and public.can_manage_campaign(campaign_id)))
  with check (public.is_admin() or (public.campaign_status_of(campaign_id) = 'draft' and public.can_manage_campaign(campaign_id)));

-- Source content is only visible after joining.
grant select, insert, update, delete on public.campaign_assets to authenticated;
create policy campaign_assets_select on public.campaign_assets for select to authenticated
  using (public.is_campaign_member(campaign_id, true) or public.can_manage_campaign(campaign_id));
create policy campaign_assets_write on public.campaign_assets for all to authenticated
  using (public.can_manage_campaign(campaign_id)) with check (public.can_manage_campaign(campaign_id));

grant select on public.campaign_creators to authenticated;
create policy campaign_creators_select on public.campaign_creators for select to authenticated
  using (creator_id = auth.uid() or public.can_manage_campaign(campaign_id));

-- ─────────────────────────────── Submissions & performance ───────────
grant select on public.submissions, public.content_metrics, public.performance_snapshots to authenticated;
create policy submissions_select on public.submissions for select to authenticated
  using (creator_id = auth.uid() or public.can_manage_campaign(campaign_id));
create policy content_metrics_select on public.content_metrics for select to authenticated
  using (public.can_view_submission(submission_id));
create policy performance_snapshots_select on public.performance_snapshots for select to authenticated
  using (public.can_view_submission(submission_id));

-- ─────────────────────────────── Money ───────────────────────────────
grant select on public.earnings, public.payout_requests to authenticated;
create policy earnings_select on public.earnings for select to authenticated using (creator_id = auth.uid() or public.is_admin());
create policy payouts_select on public.payout_requests for select to authenticated using (creator_id = auth.uid() or public.is_admin());

grant select on public.my_earnings_summary, public.campaign_funnel to authenticated;

-- ─────────────────────────────── Comms & ops ─────────────────────────
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.push_tokens to authenticated;
create policy push_tokens_own on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on public.support_tickets to authenticated;
grant insert (user_id, category, subject, body, related_id) on public.support_tickets to authenticated;
grant update (status, assigned_to) on public.support_tickets to authenticated;
create policy tickets_select on public.support_tickets for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy tickets_insert on public.support_tickets for insert to authenticated with check (user_id = auth.uid());
create policy tickets_admin_update on public.support_tickets for update to authenticated using (public.is_admin());

grant select on public.disputes to authenticated;
grant insert (raised_by, submission_id, payout_request_id, reason) on public.disputes to authenticated;
grant update (status, resolution, resolved_by, resolved_at) on public.disputes to authenticated;
create policy disputes_select on public.disputes for select to authenticated using (raised_by = auth.uid() or public.is_admin());
create policy disputes_insert on public.disputes for insert to authenticated with check (
  raised_by = auth.uid()
  and (submission_id is null or exists (select 1 from public.submissions s where s.id = submission_id and s.creator_id = auth.uid()))
  and (payout_request_id is null or exists (select 1 from public.payout_requests p where p.id = payout_request_id and p.creator_id = auth.uid())));
create policy disputes_admin_update on public.disputes for update to authenticated using (public.is_admin());

grant select on public.audit_logs to authenticated;
create policy audit_admin_read on public.audit_logs for select to authenticated using (public.is_admin());

-- ─────────────────────────────── Storage ─────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp']),
  ('brand', 'brand', true, 1048576, array['image/png','image/svg+xml']),   -- email/logo assets; admin upload via dashboard
  ('submission-proofs', 'submission-proofs', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('campaign-assets', 'campaign-assets', false, 524288000, null)
on conflict (id) do nothing;

-- Path convention: <user_id>/<file> for avatars & proofs; <campaign_id>/<file> for campaign assets.
-- avatars/brand are public buckets: files load by public URL; no SELECT policy so the bucket can't be listed.
create policy avatars_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy proofs_read on storage.objects for select to authenticated
  using (bucket_id = 'submission-proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy proofs_write on storage.objects for insert to authenticated
  with check (bucket_id = 'submission-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy campaign_assets_read on storage.objects for select to authenticated using (
  bucket_id = 'campaign-assets' and (
    public.is_admin()
    or exists (select 1 from public.campaigns c where c.id::text = (storage.foldername(name))[1]
               and (public.is_campaign_member(c.id, true) or public.can_manage_campaign(c.id)))));
create policy campaign_assets_write on storage.objects for insert to authenticated with check (
  bucket_id = 'campaign-assets' and (
    public.is_admin()
    or exists (select 1 from public.campaigns c where c.id::text = (storage.foldername(name))[1]
               and public.can_manage_campaign(c.id))));

-- TAPP · 0004 · Creator profile (Phase 2)

set search_path = public, extensions;

-- Reserved handles can't be claimed by creators.
alter table public.profiles add constraint profiles_username_not_reserved
  check (username is null or username::text not in ('admin','administrator','tapp','tappcreators','support','official','help','root','system','moderator'));

alter table public.creator_profiles
  add constraint creator_profiles_niches_max      check (cardinality(niches) <= 3),
  add constraint creator_profiles_categories_max  check (cardinality(content_categories) <= 5);

create or replace function public.is_username_available(p_username text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select lower(btrim(p_username)) ~ '^[a-z0-9_.]{3,24}$'
     and lower(btrim(p_username)) not in ('admin','administrator','tapp','tappcreators','support','official','help','root','system','moderator')
     and not exists (select 1 from public.profiles where username = lower(btrim(p_username))::citext and id <> auth.uid())
$$;
revoke execute on function public.is_username_available(text) from public, anon;
grant execute on function public.is_username_available(text) to authenticated;

-- If a creator unlinks their main platform, fall back to another linked one (or null).
create or replace function public.reset_main_platform() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.creator_profiles cp
  set main_platform = (select platform from public.creator_platforms where creator_id = old.creator_id order by created_at limit 1)
  where cp.user_id = old.creator_id and cp.main_platform = old.platform
    and not exists (select 1 from public.creator_platforms where creator_id = old.creator_id and platform = old.platform);
  return old;
end $$;
create trigger creator_platforms_reset_main after delete on public.creator_platforms
  for each row execute function public.reset_main_platform();

-- Read model for the profile screen. security_invoker: creators only see their own rows.
create or replace view public.my_creator_stats with (security_invoker = true) as
select cp.user_id as creator_id,
  (select count(*) from public.campaign_creators m where m.creator_id = cp.user_id)                                         as campaigns_joined,
  (select count(*) from public.submissions s where s.creator_id = cp.user_id)                                               as submissions,
  (select count(*) from public.submissions s where s.creator_id = cp.user_id and s.status in ('approved','tracking','completed')) as approved,
  (select count(*) from public.submissions s where s.creator_id = cp.user_id and s.status = 'rejected')                      as rejected,
  (select coalesce(sum(s.qualified_views), 0) from public.submissions s where s.creator_id = cp.user_id)                    as qualified_views,
  (select coalesce(sum(e.amount), 0) from public.earnings e where e.creator_id = cp.user_id)                                as total_earned
from public.creator_profiles cp;
grant select on public.my_creator_stats to authenticated;

-- TAPP · 0001 · Core relational schema
-- Money is stored as integer IDR (bigint). No floats anywhere in financial paths.

create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;
set search_path = public, extensions;

-- ─────────────────────────────── Enums ───────────────────────────────
create type public.user_role         as enum ('creator','brand','admin');
create type public.creator_status    as enum ('pending','verified','active','suspended','banned');
create type public.creator_tier      as enum ('new','rising','proven');
create type public.platform          as enum ('tiktok','instagram','youtube','x','facebook','other');
create type public.campaign_status   as enum ('draft','pending_approval','active','paused','ending','completed','archived','cancelled');
create type public.membership_status as enum ('joined','left','removed');
create type public.submission_status as enum ('pending_review','needs_changes','approved','rejected','flagged','tracking','completed');
create type public.content_state     as enum ('live','deleted','private','unknown');
create type public.earning_status    as enum ('pending','available','paid','reversed');
create type public.payout_status     as enum ('requested','reviewing','approved','processing','paid','rejected');
create type public.metric_source     as enum ('manual','api','import');
create type public.ticket_status     as enum ('open','pending','resolved','closed');
create type public.dispute_status    as enum ('open','under_review','resolved','rejected');

-- ─────────────────────────────── Helpers ─────────────────────────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$ begin new.updated_at := now(); return new; end $$;

create or replace function public.forbid_mutation() returns trigger
language plpgsql set search_path = public as $$ begin raise exception 'append_only_table:%', tg_table_name; end $$;

-- ─────────────────────────────── Settings ────────────────────────────
create table public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.app_settings (key, value) values
  ('earnings_hold_days',        '7'),        -- earnings mature before becoming payable
  ('min_payout_idr',            '50000'),
  ('max_submissions_per_day',   '20'),
  ('publish_grace_minutes',     '60'),       -- post may predate join by this much
  ('view_milestones',           '[10000,50000,100000,250000,500000,1000000]');

-- ─────────────────────────────── Identity ────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        public.user_role not null default 'creator',
  full_name   text check (char_length(full_name) between 1 and 80),
  username    citext unique check (username::text ~ '^[a-z0-9_.]{3,24}$' and username::text = lower(username::text)),
  avatar_url  text,
  country     char(2) check (country ~ '^[A-Z]{2}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

create table public.creator_profiles (
  user_id                 uuid primary key references public.profiles(id) on delete cascade,
  status                  public.creator_status not null default 'pending',
  status_reason           text,
  status_changed_at       timestamptz,
  tier                    public.creator_tier not null default 'new',
  main_platform           public.platform,
  niches                  text[] not null default '{}',
  content_categories      text[] not null default '{}',
  content_style           text check (char_length(content_style) <= 280),
  audience                jsonb not null default '{}',   -- {primary_country, age_range, gender_split, ...}
  experience_level        text check (experience_level in ('none','beginner','intermediate','advanced')),
  reliability_score       numeric(5,2) not null default 0 check (reliability_score between 0 and 100),
  onboarding_completed_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index creator_profiles_status_idx on public.creator_profiles(status);
create index creator_profiles_niches_idx on public.creator_profiles using gin(niches);
create trigger creator_profiles_touch before update on public.creator_profiles for each row execute function public.touch_updated_at();

create table public.creator_platforms (
  id           uuid primary key default gen_random_uuid(),
  creator_id   uuid not null references public.creator_profiles(user_id) on delete cascade,
  platform     public.platform not null,
  handle       text not null check (handle ~ '^[A-Za-z0-9_.\-]{1,64}$'),
  profile_url  text,
  followers    integer check (followers >= 0),
  is_primary   boolean not null default false,
  verified_at  timestamptz,
  created_at   timestamptz not null default now()
);
-- One social account can belong to one TAPP creator only (anti account-sharing).
create unique index creator_platforms_account_key on public.creator_platforms(platform, lower(handle));
create index creator_platforms_creator_idx on public.creator_platforms(creator_id);

create table public.creator_payout_methods (
  id              uuid primary key default gen_random_uuid(),
  creator_id      uuid not null references public.creator_profiles(user_id) on delete cascade,
  kind            text not null check (kind in ('bank','ewallet')),
  provider        text not null check (char_length(provider) between 2 and 40),  -- BCA, Mandiri, GoPay, DANA, OVO…
  account_name    text not null check (char_length(account_name) between 2 and 80),
  account_number  text not null check (account_number ~ '^[0-9+]{6,24}$'),
  is_default      boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index creator_payout_methods_default_key on public.creator_payout_methods(creator_id) where is_default;
create trigger creator_payout_methods_touch before update on public.creator_payout_methods for each row execute function public.touch_updated_at();

-- ─────────────────────────────── Brands ──────────────────────────────
create table public.brands (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 80),
  slug        citext not null unique,
  logo_url    text,
  website     text,
  status      text not null default 'active' check (status in ('pending','active','suspended')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger brands_touch before update on public.brands for each row execute function public.touch_updated_at();

create table public.brand_members (
  brand_id   uuid not null references public.brands(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner','member','viewer')),
  created_at timestamptz not null default now(),
  primary key (brand_id, user_id)
);
create index brand_members_user_idx on public.brand_members(user_id);

-- ─────────────────────────────── Campaigns ───────────────────────────
create table public.campaigns (
  id                          uuid primary key default gen_random_uuid(),
  brand_id                    uuid not null references public.brands(id) on delete restrict,
  title                       text not null check (char_length(title) between 3 and 120),
  objective                   text,
  description                 text,
  category                    text not null,
  content_type                text not null default 'short_form_clip',
  status                      public.campaign_status not null default 'draft',
  status_reason               text,
  currency                    char(3) not null default 'IDR',
  cpm                         bigint not null check (cpm > 0),            -- IDR per 1,000 qualified views
  budget                      bigint not null check (budget > 0),
  earned                      bigint not null default 0,                  -- net allocated to creators (ledger sum)
  paid                        bigint not null default 0 check (paid >= 0),
  budget_override             boolean not null default false,             -- admin-only escape hatch
  max_earning_per_submission  bigint check (max_earning_per_submission > 0),
  min_views_to_qualify        integer not null default 0 check (min_views_to_qualify >= 0),
  starts_at                   timestamptz,
  ends_at                     timestamptz,
  submission_deadline         timestamptz,
  guidelines_do               text[] not null default '{}',
  guidelines_dont             text[] not null default '{}',
  terms                       text,
  created_by                  uuid references public.profiles(id),
  approved_by                 uuid references public.profiles(id),
  approved_at                 timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint campaigns_budget_guard check (budget_override or earned <= budget),
  constraint campaigns_window check (ends_at is null or starts_at is null or ends_at > starts_at),
  constraint campaigns_deadline check (submission_deadline is null or ends_at is null or submission_deadline <= ends_at)
);
create index campaigns_status_idx on public.campaigns(status);
create index campaigns_brand_idx on public.campaigns(brand_id);
create index campaigns_category_idx on public.campaigns(category) where status = 'active';
create trigger campaigns_touch before update on public.campaigns for each row execute function public.touch_updated_at();

create table public.campaign_platforms (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  platform    public.platform not null,
  primary key (campaign_id, platform)
);

create table public.campaign_assets (   -- source content creators clip from
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.campaigns(id) on delete cascade,
  kind          text not null check (kind in ('video','audio','image','document','link')),
  title         text not null,
  url           text,
  storage_path  text,
  sort          integer not null default 0,
  created_at    timestamptz not null default now(),
  constraint campaign_assets_source check (url is not null or storage_path is not null)
);
create index campaign_assets_campaign_idx on public.campaign_assets(campaign_id, sort);

create table public.campaign_rules (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  kind        text not null check (kind in ('requirement','submission','performance')),
  body        text not null,
  sort        integer not null default 0
);
create index campaign_rules_campaign_idx on public.campaign_rules(campaign_id, sort);

create table public.campaign_creators (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references public.campaigns(id) on delete cascade,
  creator_id      uuid not null references public.creator_profiles(user_id) on delete cascade,
  status          public.membership_status not null default 'joined',
  status_reason   text,
  joined_at       timestamptz not null default now(),
  left_at         timestamptz,
  created_at      timestamptz not null default now(),
  unique (campaign_id, creator_id)
);
create index campaign_creators_creator_idx on public.campaign_creators(creator_id, status);

-- ─────────────────────────────── Submissions ─────────────────────────
create table public.submissions (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      uuid not null references public.campaigns(id) on delete restrict,
  creator_id       uuid not null references public.creator_profiles(user_id) on delete restrict,
  membership_id    uuid not null references public.campaign_creators(id) on delete restrict,
  platform         public.platform not null,
  post_url         text not null,
  normalized_url   text not null,
  published_at     timestamptz not null,
  screenshot_path  text,
  caption          text check (char_length(caption) <= 2200),
  status           public.submission_status not null default 'pending_review',
  review_reason    text,
  reviewed_by      uuid references public.profiles(id),
  reviewed_at      timestamptz,
  content_state    public.content_state not null default 'unknown',
  qualified_views  bigint not null default 0 check (qualified_views >= 0),  -- cache of latest snapshot
  earned           bigint not null default 0,                               -- cache of ledger sum
  last_metrics_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint submissions_reason_required
    check (status not in ('rejected','needs_changes','flagged') or review_reason is not null)
);
-- A piece of content can only ever be submitted once, across all campaigns and creators.
create unique index submissions_normalized_url_key on public.submissions(normalized_url);
create index submissions_creator_idx  on public.submissions(creator_id, created_at desc);
create index submissions_campaign_idx on public.submissions(campaign_id, status);
create index submissions_review_queue_idx on public.submissions(created_at) where status in ('pending_review','flagged');
create trigger submissions_touch before update on public.submissions for each row execute function public.touch_updated_at();

-- Raw metrics: append-only, never overwritten.
create table public.content_metrics (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete restrict,
  captured_at   timestamptz not null,
  views         bigint not null check (views >= 0),
  likes         bigint not null default 0 check (likes >= 0),
  comments      bigint not null default 0 check (comments >= 0),
  shares        bigint not null default 0 check (shares >= 0),
  saves         bigint not null default 0 check (saves >= 0),
  source        public.metric_source not null default 'manual',
  raw           jsonb not null default '{}',
  recorded_by   uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);
create index content_metrics_submission_idx on public.content_metrics(submission_id, captured_at desc);
create trigger content_metrics_append_only before update or delete on public.content_metrics
  for each row execute function public.forbid_mutation();

-- Qualification decisions: append-only history of raw → qualified.
create table public.performance_snapshots (
  id                        uuid primary key default gen_random_uuid(),
  submission_id             uuid not null references public.submissions(id) on delete restrict,
  metric_id                 uuid not null references public.content_metrics(id) on delete restrict,
  raw_views                 bigint not null,
  qualified_views           bigint not null check (qualified_views >= 0),
  previous_qualified_views  bigint not null,
  budget_capped             boolean not null default false,
  note                      text,
  computed_by               uuid references public.profiles(id),
  created_at                timestamptz not null default now(),
  constraint snapshot_qualified_le_raw check (qualified_views <= raw_views)
);
create index performance_snapshots_submission_idx on public.performance_snapshots(submission_id, created_at desc);
create trigger performance_snapshots_append_only before update or delete on public.performance_snapshots
  for each row execute function public.forbid_mutation();

-- ─────────────────────────────── Money ───────────────────────────────
create table public.payout_requests (
  id                  uuid primary key default gen_random_uuid(),
  creator_id          uuid not null references public.creator_profiles(user_id) on delete restrict,
  amount              bigint not null check (amount > 0),
  status              public.payout_status not null default 'requested',
  payout_method       jsonb not null,           -- snapshot at request time
  idempotency_key     uuid not null,
  review_reason       text,
  reviewed_by         uuid references public.profiles(id),
  reviewed_at         timestamptz,
  processed_reference text,                     -- bank / e-wallet transfer reference
  paid_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (creator_id, idempotency_key),
  constraint payout_rejection_reason check (status <> 'rejected' or review_reason is not null),
  constraint payout_paid_reference   check (status <> 'paid' or (processed_reference is not null and paid_at is not null))
);
-- At most one open payout per creator.
create unique index payout_requests_one_open_key on public.payout_requests(creator_id)
  where status in ('requested','reviewing','approved','processing');
create index payout_requests_queue_idx on public.payout_requests(status, created_at);
create trigger payout_requests_touch before update on public.payout_requests for each row execute function public.touch_updated_at();

-- Earnings ledger: one row per qualification delta (can be negative for downward adjustments).
create table public.earnings (
  id                     uuid primary key default gen_random_uuid(),
  creator_id             uuid not null references public.creator_profiles(user_id) on delete restrict,
  campaign_id            uuid not null references public.campaigns(id) on delete restrict,
  submission_id          uuid not null references public.submissions(id) on delete restrict,
  snapshot_id            uuid not null unique references public.performance_snapshots(id) on delete restrict,
  qualified_views_delta  bigint not null,
  cpm                    bigint not null,
  amount                 bigint not null check (amount <> 0),
  status                 public.earning_status not null,
  available_at           timestamptz not null,
  payout_request_id      uuid references public.payout_requests(id) on delete restrict,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint earnings_paid_has_payout check (status <> 'paid' or payout_request_id is not null)
);
create index earnings_creator_idx on public.earnings(creator_id, status);
create index earnings_campaign_idx on public.earnings(campaign_id);
create index earnings_payout_idx on public.earnings(payout_request_id) where payout_request_id is not null;
create index earnings_maturing_idx on public.earnings(available_at) where status = 'pending';
create trigger earnings_touch before update on public.earnings for each row execute function public.touch_updated_at();

-- ─────────────────────────────── Comms & ops ─────────────────────────
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text not null,        -- campaign_new, submission_approved, submission_rejected, submission_needs_changes,
                                    -- performance_milestone, earnings_update, payout_update, account_status
  title       text not null,
  body        text not null,
  data        jsonb not null default '{}',
  push_sent_at timestamptz,
  push_error  text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, created_at desc);
create index notifications_unsent_idx on public.notifications(created_at) where push_sent_at is null and push_error is null;

create table public.push_tokens (
  token       text primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  platform    text not null check (platform in ('ios','android')),
  updated_at  timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens(user_id);

create table public.support_tickets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  category     text not null check (category in ('account','campaign','submission','earnings','payout','other')),
  subject      text not null check (char_length(subject) between 3 and 120),
  body         text not null check (char_length(body) between 10 and 4000),
  related_id   uuid,
  status       public.ticket_status not null default 'open',
  assigned_to  uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index support_tickets_user_idx on public.support_tickets(user_id, created_at desc);
create trigger support_tickets_touch before update on public.support_tickets for each row execute function public.touch_updated_at();

create table public.disputes (
  id                 uuid primary key default gen_random_uuid(),
  raised_by          uuid not null references public.profiles(id) on delete cascade,
  submission_id      uuid references public.submissions(id) on delete restrict,
  payout_request_id  uuid references public.payout_requests(id) on delete restrict,
  reason             text not null check (char_length(reason) between 10 and 2000),
  status             public.dispute_status not null default 'open',
  resolution         text,
  resolved_by        uuid references public.profiles(id),
  resolved_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint disputes_target check (submission_id is not null or payout_request_id is not null)
);
create index disputes_status_idx on public.disputes(status, created_at);
create trigger disputes_touch before update on public.disputes for each row execute function public.touch_updated_at();

create table public.audit_logs (
  id           bigint generated always as identity primary key,
  actor_id     uuid,
  actor_role   public.user_role,
  action       text not null,
  entity_type  text not null,
  entity_id    uuid,
  before       jsonb,
  after        jsonb,
  metadata     jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs(actor_id, created_at desc);
create trigger audit_logs_append_only before update or delete on public.audit_logs
  for each row execute function public.forbid_mutation();

-- ─────────────────────────────── New-user bootstrap ──────────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(btrim(new.raw_user_meta_data->>'full_name'), ''));
  insert into public.creator_profiles (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

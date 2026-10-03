-- TAPP · 0041 · Automatic check of a submitted link, right after the creator submits.
--
-- The submission-check Edge Function opens the public post and records what it found: whether the post exists,
-- whether it was posted by the creator's linked account, and its public counters at that moment.
-- It never approves or rejects anything — the admin sees the result next to the submission and decides.
--   status: ok         post found, posted by the creator's account, views read
--           not_owner  post found, but by another account (author holds the account that posted it)
--           not_found  link does not open a post (deleted, private, wrong link)
--           unreadable the platform could not be read automatically (admin checks by hand)

set search_path = public, extensions;

create table if not exists public.submission_checks (
  submission_id uuid primary key references public.submissions(id) on delete cascade,
  status        text not null check (status in ('ok', 'not_owner', 'not_found', 'unreadable')),
  author        text,
  views         bigint check (views >= 0),
  likes         bigint check (likes >= 0),
  comments      bigint check (comments >= 0),
  shares        bigint check (shares >= 0),
  note          text,
  checked_at    timestamptz not null default now()
);
alter table public.submission_checks enable row level security;

drop policy if exists submission_checks_read on public.submission_checks;
create policy submission_checks_read on public.submission_checks for select to authenticated using (
  public.is_admin() or exists (select 1 from public.submissions s where s.id = submission_id and s.creator_id = auth.uid())
);
-- Written only by the Edge Function (service role); no client writes.
revoke insert, update, delete on public.submission_checks from anon, authenticated;
grant select on public.submission_checks to authenticated;

-- The "friend joined" notice now states both bonus conditions from 0072 (3 accepted clips + first paid withdrawal).
create or replace function public.claim_referral(p_code text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_ref uuid; v_created timestamptz;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_code is null or btrim(p_code) = '' then return false; end if;
  select id into v_ref from public.profiles where referral_code = upper(btrim(p_code));
  if v_ref is null or v_ref = v_uid then return false; end if;
  select created_at into v_created from public.profiles where id = v_uid;
  if v_created < now() - interval '14 days' then return false; end if;
  if exists (select 1 from public.payout_requests where creator_id = v_uid) then return false; end if;
  insert into public.referrals (referee_id, referrer_id) values (v_uid, v_ref) on conflict (referee_id) do nothing;
  if not found then return false; end if;
  perform public.notify(v_ref, 'referral', 'Teman kamu bergabung',
    'Seseorang daftar lewat link undanganmu. Bonus masuk setelah dia punya 3 klip diterima dan pencairan pertamanya dibayar.',
    jsonb_build_object('referee', v_uid));
  return true;
end $$;
revoke execute on function public.claim_referral(text) from public, anon;
grant execute on function public.claim_referral(text) to authenticated;

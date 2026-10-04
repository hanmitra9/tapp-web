-- TAPP · 0049 · Approving a clip credits it in the same step, so the campaign budget is cut the moment the admin
-- approves (campaigns.earned → admin_campaigns.remaining). One transaction: if crediting fails, nothing is approved.
--   admin_approve_submission(id, views): pending_review/flagged → approved (+ notify) → admin_credit_submission(id, views).
-- Views below the campaign minimum approve the clip with Rp0 credited; more views can be credited later.

set search_path = public, extensions;

create or replace function public.admin_approve_submission(p_submission_id uuid, p_views bigint, p_note text default null)
returns public.submissions
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.assert_admin();
  if p_views is null or p_views < 0 then raise exception 'invalid_views'; end if;
  perform public.admin_review_submission(p_submission_id, 'approved', null);
  return public.admin_credit_submission(p_submission_id, p_views, p_note);
end $$;
revoke execute on function public.admin_approve_submission(uuid, bigint, text) from public, anon;
grant execute on function public.admin_approve_submission(uuid, bigint, text) to authenticated;

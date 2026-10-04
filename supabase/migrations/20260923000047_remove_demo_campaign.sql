-- TAPP · 0047 · Remove the archived demo campaign "Ruang Cuan Ep. 48" (never had members, clips or earnings).
delete from public.campaigns
where id = '20000000-0000-0000-0000-000000000001' and status = 'archived' and earned = 0
  and not exists (select 1 from public.submissions s where s.campaign_id = '20000000-0000-0000-0000-000000000001')
  and not exists (select 1 from public.earnings e where e.campaign_id = '20000000-0000-0000-0000-000000000001');

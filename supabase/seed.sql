-- Dev seed: one brand and one active campaign so the marketplace has real data. Do not run in production.
insert into public.brands (id, name, slug) values ('10000000-0000-0000-0000-000000000001', 'Ruang Cuan Podcast', 'ruang-cuan')
on conflict do nothing;
insert into public.campaigns (id, brand_id, title, objective, description, category, content_type, cpm, budget, status,
  submission_deadline, ends_at, min_views_to_qualify, guidelines_do, guidelines_dont, terms)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
  'Ruang Cuan Ep. 48 — Investasi di Usia 20-an', 'Mendorong pendengar podcast dari audiens finansial di video pendek.',
  'Potong momen terbaik dari episode 48 tentang cara mulai investasi di usia 20-an. Fokus pada satu insight per klip.',
  'finance', 'podcast_clips', 3000, 15000000, 'active', now() + interval '21 days', now() + interval '30 days', 1000,
  array['Hook kuat di 2 detik pertama','Subtitle bahasa Indonesia langsung di video','Tag @ruangcuan di caption'],
  array['Jangan menjanjikan keuntungan pasti','Jangan reupload episode penuh','Jangan pakai views berbayar'],
  'Views dari promosi berbayar, bot, atau akun repost tidak dihitung.')
on conflict do nothing;
insert into public.campaign_platforms values
  ('20000000-0000-0000-0000-000000000001','tiktok'), ('20000000-0000-0000-0000-000000000001','instagram'),
  ('20000000-0000-0000-0000-000000000001','youtube') on conflict do nothing;
insert into public.campaign_rules (campaign_id, kind, body, sort) values
  ('20000000-0000-0000-0000-000000000001','requirement','Format vertikal 9:16, durasi 15–90 detik',1),
  ('20000000-0000-0000-0000-000000000001','submission','Submit maksimal 48 jam setelah posting',2),
  ('20000000-0000-0000-0000-000000000001','performance','Penghasilan mulai dihitung setelah 1.000 qualified views',3);

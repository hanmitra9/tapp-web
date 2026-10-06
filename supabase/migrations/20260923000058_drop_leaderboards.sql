-- Leaderboards removed from the product: drop every board function, the name-mask helper and the prize setting.
drop function if exists public.campaign_leaderboard(uuid, integer);
drop function if exists public.weekly_leaderboard(integer);
drop function if exists public.city_leaderboard(integer);
drop function if exists public.alltime_leaderboard(integer);
drop function if exists public.monthly_leaderboard(integer);
drop function if exists public.leaderboard_meta();
drop function if exists private.mask_name(text);
delete from public.app_settings where key = 'leaderboard_prizes';

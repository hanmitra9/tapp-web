-- Minimum withdrawal back to Rp50.000 (was Rp100.000 since 0045).
update public.app_settings set value = '50000'::jsonb, updated_at = now() where key = 'min_payout_idr';

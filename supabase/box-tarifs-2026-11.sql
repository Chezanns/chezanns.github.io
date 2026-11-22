-- Chez Ann's — nouveaux tarifs des box (novembre 2026)
-- À lancer une fois dans Supabase → SQL Editor → Run
update public.boxes set pieces = 45, price_cents = 6500  where id = 'signature';
update public.boxes set pieces = 70, price_cents = 10000 where id = 'prestige';

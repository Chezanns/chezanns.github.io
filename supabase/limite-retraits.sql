-- Chez Ann's — limite de retraits par jour
-- À lancer une fois dans Supabase → SQL Editor → Run
-- Pour changer la limite : remplacer le 3 ci-dessous et relancer ce fichier.

create or replace function public.full_days(d_from date, d_to date)
returns setof date
language sql stable security definer set search_path = public as $$
  select pickup_date
  from public.orders
  where pickup_date between d_from and d_to
    and (
      status in ('confirmee', 'prete', 'recuperee')
      -- une commande en cours de paiement réserve sa place pendant 1 h
      or (status = 'attente_paiement' and created_at > now() - interval '1 hour')
    )
  group by pickup_date
  having count(*) >= 3   -- ← nombre maximum de retraits par jour
$$;

-- Le site peut savoir quels jours sont complets (sans voir aucune commande)
grant execute on function public.full_days(date, date) to anon, authenticated;

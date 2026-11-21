-- Chez Ann's — mise à jour de la liste des mignardises Classiques (novembre 2026)
-- À lancer une fois dans Supabase → SQL Editor → Run

-- Nouvelles lignes
insert into public.items (id, name, univers) values
  ('mini-croissant-poulet', 'Mini croissant saucisse de poulet', 'classique'),
  ('mini-croissant-jambon', 'Mini croissant jambon fromage',     'classique'),
  ('mini-quiche-saumon',    'Mini quiche saumon',                'classique'),
  ('mini-quiche-jambon',    'Mini quiche jambon fromage',        'classique'),
  ('wrap-jambon-fromage',   'Wrap jambon fromage',               'classique')
on conflict (id) do update set name = excluded.name, univers = excluded.univers, active = true;

-- Anciennes lignes retirées de la carte (gardées pour l'historique, mais plus commandables)
update public.items set active = false where id in ('tapas', 'mini-croissant', 'mini-quiche');

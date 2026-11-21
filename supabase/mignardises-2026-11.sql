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

-- Mignardises Caraïbes : accras et bokits séparés (accras au poulet retirés)
insert into public.items (id, name, univers) values
  ('accras-morue',      'Accras de morue',                'caraibes'),
  ('accras-crevette',   'Accras de crevette',             'caraibes'),
  ('mini-bokit-poulet', 'Mini bokit poulet',              'caraibes'),
  ('mini-bokit-morue',  'Mini bokit morue',               'caraibes'),
  ('mini-bokit-steak',  'Mini bokit steak haché fromage', 'caraibes')
on conflict (id) do update set name = excluded.name, univers = excluded.univers, active = true;

update public.items set active = false where id in ('accras', 'mini-bokit');

-- Samoussas Caraïbes séparés
insert into public.items (id, name, univers) values
  ('samoussa-thon',    'Samoussa thon',    'caraibes'),
  ('samoussa-legumes', 'Samoussa légumes', 'caraibes')
on conflict (id) do update set name = excluded.name, univers = excluded.univers, active = true;

update public.items set active = false where id = 'samoussa-thon-legumes';

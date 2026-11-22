-- Chez Ann's — prix à la pièce des mignardises Caraïbes (Box Caraïbes composée sur mesure)
-- À lancer une fois dans Supabase → SQL Editor → Run
alter table public.items add column if not exists price_cents int;

-- Gamme simple : 1,50 €
update public.items set price_cents = 150 where id in ('accras-morue', 'accras-crevette', 'samoussa-thon', 'samoussa-legumes', 'kalawang');
-- Gamme élaborée : 2,50 €
update public.items set price_cents = 250 where id in ('dize-mile', 'navette-poulet-fume', 'verrine-guacamole');
-- Gamme premium : 4 €
update public.items set price_cents = 400 where id in ('mini-bokit-poulet', 'mini-bokit-morue', 'mini-bokit-steak', 'sandwich-madras');

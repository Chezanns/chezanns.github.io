-- Chez Ann's — nouveaux produits de Noël : pain au beurre et chocolat créole
-- À lancer une fois dans Supabase → SQL Editor → Run

-- Les produits peuvent maintenant être vendus au litre
alter table public.products drop constraint if exists products_unit_check;
alter table public.products add constraint products_unit_check check (unit in ('piece', 'kg', 'litre'));

insert into public.products (id, name, description, unit, price_cents, min_qty, step, is_boudin, sort) values
  ('pain-beurre',     'Pain au beurre en couronne', 'Pour 8 à 10 personnes',                 'piece', 800,  1, 1, false, 3),
  ('chocolat-creole', 'Chocolat créole',            'Le chocolat chaud des fêtes antillaises', 'litre', 1000, 1, 1, false, 4)
on conflict (id) do update set name = excluded.name, description = excluded.description, unit = excluded.unit,
  price_cents = excluded.price_cents, min_qty = excluded.min_qty, step = excluded.step, sort = excluded.sort, active = true;

-- Les boudins passent après les douceurs
update public.products set sort = sort + 2 where is_boudin and sort < 10;

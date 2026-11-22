-- Chez Ann's — petit pain au beurre à la pièce (2 €)
-- À lancer une fois dans Supabase → SQL Editor → Run
insert into public.products (id, name, description, unit, price_cents, min_qty, step, is_boudin, sort) values
  ('petit-pain-beurre', 'Petit pain au beurre', 'À la pièce', 'piece', 200, 1, 1, false, 4)
on conflict (id) do update set name = excluded.name, description = excluded.description, unit = excluded.unit,
  price_cents = excluded.price_cents, min_qty = excluded.min_qty, step = excluded.step, active = true;

-- Ordre d'affichage
update public.products set sort = 1 where id = 'dize-mile-sucre';
update public.products set sort = 2 where id = 'comtesses';
update public.products set sort = 3 where id = 'pain-beurre';
update public.products set sort = 4 where id = 'petit-pain-beurre';
update public.products set sort = 5 where id = 'chocolat-creole';
update public.products set sort = 6 where id = 'boudin-creole';
update public.products set sort = 7 where id = 'boudin-morue';
update public.products set sort = 8 where id = 'boudin-poulet';
update public.products set sort = 9 where id = 'boudin-crevette';

-- Chez Ann's — boutique de Noël
-- À lancer une fois dans Supabase → SQL Editor → Run

-- Produits vendus à l'unité ou au poids
create table if not exists public.products (
  id          text primary key,
  name        text not null,
  description text,
  unit        text not null check (unit in ('piece', 'kg')),
  price_cents int  not null,          -- prix à la pièce, ou au kilo
  min_qty     int  not null,          -- en pièces, ou en grammes
  step        int  not null,          -- en pièces, ou en grammes
  is_boudin   boolean not null default false,
  season      text not null default 'noel',
  sort        int  not null default 0,
  active      boolean not null default true
);
alter table public.products enable row level security;
drop policy if exists "produits publics" on public.products;
create policy "produits publics" on public.products for select using (true);

insert into public.products (id, name, description, unit, price_cents, min_qty, step, is_boudin, sort) values
  ('dize-mile-sucre',  'Dizé milé',         'Petit gâteau fourré à la crème', 'piece',  125,   6,   1, false, 1),
  ('comtesses',        'Comtesses',         'Petits gâteaux sablés',          'piece',   50,   6,   1, false, 2),
  ('boudin-creole',    'Boudin créole',     null,                             'kg',    1800, 500, 500, true,  3),
  ('boudin-morue',     'Boudin de morue',   null,                             'kg',    3000, 500, 500, true,  4),
  ('boudin-poulet',    'Boudin de poulet',  null,                             'kg',    2500, 500, 500, true,  5),
  ('boudin-crevette',  'Boudin de crevette', null,                            'kg',    3500, 500, 500, true,  6)
on conflict (id) do update set name = excluded.name, description = excluded.description, unit = excluded.unit,
  price_cents = excluded.price_cents, min_qty = excluded.min_qty, step = excluded.step,
  is_boudin = excluded.is_boudin, sort = excluded.sort;

-- Les commandes peuvent être des box ou des commandes de Noël
alter table public.orders add column if not exists kind  text not null default 'box';
alter table public.orders add column if not exists lines jsonb;
alter table public.orders alter column box_id drop not null;

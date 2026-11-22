-- ═══════════════════════════════════════════════════════════
--  Chez Ann's — base de données Supabase
--  À coller dans Supabase → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════

-- Les box (le prix fait foi pour le calcul de l'acompte)
create table if not exists public.boxes (
  id            text primary key,
  name          text not null,
  pieces        int,
  max_varieties int  not null,
  price_cents   int,             -- null = sur devis
  only_univers  text,            -- 'caraibes' = uniquement l'univers Caraïbes
  active        boolean not null default true,
  sort          int not null default 0
);

-- Les mignardises au choix
create table if not exists public.items (
  id      text primary key,
  name    text not null,
  univers text not null check (univers in ('classique', 'caraibes')),
  active  boolean not null default true
);

-- Les commandes
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  ref               text not null unique,
  created_at        timestamptz not null default now(),
  box_id            text not null references public.boxes(id),
  box_name          text not null,
  qty               int  not null default 1 check (qty between 1 and 10),
  items             text[] not null default '{}',
  spice             smallint not null default 0 check (spice between 0 and 3), -- 0 pas épicé → 3 ça décoiffe
  customer_name     text not null,
  phone             text not null,
  email             text not null,
  pickup_date       date not null,
  pickup_slot       text not null,
  notes             text,
  guests            int,
  total_cents       int,
  deposit_cents     int,              -- montant payé en ligne (acompte ou totalité)
  pay_full          boolean not null default false,
  deposit_paid      boolean not null default false,
  paid_at           timestamptz,
  stripe_session_id text,
  confirm_email_sent_at timestamptz,  -- e-mail « commande confirmée » envoyé
  ready_email_sent_at   timestamptz,  -- e-mail « commande prête » envoyé
  status            text not null default 'attente_paiement'
                    check (status in ('attente_paiement','confirmee','prete','recuperee','devis','devis_traite','annulee'))
);
alter table public.orders add column if not exists confirm_email_sent_at timestamptz;
alter table public.orders add column if not exists ready_email_sent_at timestamptz;
alter table public.orders add column if not exists pay_full boolean not null default false;
alter table public.orders add column if not exists spice smallint not null default 0 check (spice between 0 and 3);
create index if not exists orders_pickup_idx on public.orders (pickup_date, pickup_slot);

-- Qui a accès au tableau de bord
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ── Sécurité (RLS) ──────────────────────────────────────────
alter table public.boxes  enable row level security;
alter table public.items  enable row level security;
alter table public.orders enable row level security;
alter table public.admins enable row level security;

drop policy if exists "boxes publiques" on public.boxes;
create policy "boxes publiques" on public.boxes for select using (true);

drop policy if exists "items publics" on public.items;
create policy "items publics" on public.items for select using (true);

-- Les commandes ne sont visibles et modifiables QUE par Annie (admins).
-- Les clients n'y ont jamais accès : les commandes sont créées par la fonction create-order.
drop policy if exists "admin lit les commandes" on public.orders;
create policy "admin lit les commandes" on public.orders
  for select to authenticated using (public.is_admin());

drop policy if exists "admin modifie les commandes" on public.orders;
create policy "admin modifie les commandes" on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin se voit" on public.admins;
create policy "admin se voit" on public.admins
  for select to authenticated using (user_id = auth.uid());

-- ── Données de départ ──────────────────────────────────────
insert into public.boxes (id, name, pieces, max_varieties, price_cents, only_univers, sort) values
  ('decouverte', 'Box Découverte',   20, 5, 3000,  null,       1),
  ('signature',  'Box Signature',    45, 7, 6500,  null,       2),
  ('prestige',   'Box Prestige',     70, 6, 10000, null,       3),
  ('caraibes',   'Box Caraïbes',   null, 5, null,  'caraibes', 4)
on conflict (id) do update set
  name = excluded.name, pieces = excluded.pieces, max_varieties = excluded.max_varieties,
  price_cents = excluded.price_cents, only_univers = excluded.only_univers, sort = excluded.sort;

insert into public.items (id, name, univers) values
  ('mini-burger',            'Mini burger',                                        'classique'),
  ('mini-croissant-poulet',  'Mini croissant saucisse de poulet',                  'classique'),
  ('mini-croissant-jambon',  'Mini croissant jambon fromage',                      'classique'),
  ('navette-poulet-salade',  'Navette poulet fumé et salade',                      'classique'),
  ('toast-olives',           'Toast aux olives épicées',                           'classique'),
  ('wrap-jambon-fromage',    'Wrap jambon fromage',                                'classique'),
  ('mini-hot-dog',           'Mini hot-dog',                                       'classique'),
  ('mini-croque',            'Mini croque-monsieur',                               'classique'),
  ('mini-quiche-saumon',     'Mini quiche saumon',                                 'classique'),
  ('mini-quiche-jambon',     'Mini quiche jambon fromage',                         'classique'),
  ('tartelette-thon',        'Mini tartelette au thon',                            'classique'),
  ('toast-avocat-crevette',  'Toast avocat crevette',                              'classique'),
  ('samoussa-poulet',        'Samoussa poulet',                                    'classique'),
  ('verrine-crudites',       'Verrine de crudités',                                'classique'),
  ('accras-morue',           'Accras de morue',                                    'caraibes'),
  ('accras-crevette',        'Accras de crevette',                                 'caraibes'),
  ('sandwich-madras',        'Mini sandwich madras',                               'caraibes'),
  ('mini-bokit-poulet',      'Mini bokit poulet',                                  'caraibes'),
  ('mini-bokit-morue',       'Mini bokit morue',                                   'caraibes'),
  ('mini-bokit-steak',       'Mini bokit steak haché fromage',                     'caraibes'),
  ('dize-mile',              'Dizé milé salé au poulet',                           'caraibes'),
  ('kalawang',               'Kalawang (salade de mangue)',                        'caraibes'),
  ('navette-poulet-fume',    'Navette au poulet fumé',                             'caraibes'),
  ('samoussa-thon',          'Samoussa thon',                                      'caraibes'),
  ('samoussa-legumes',       'Samoussa légumes',                                   'caraibes'),
  ('verrine-guacamole',      'Verrine guacamole',                                  'caraibes')
on conflict (id) do update set name = excluded.name, univers = excluded.univers;

-- ── Donner l'accès au tableau de bord à Annie ──────────────
-- 1) Créez son compte : Authentication → Users → Add user (e-mail + mot de passe)
-- 2) Puis lancez cette ligne en remplaçant l'e-mail :
-- insert into public.admins (user_id) select id from auth.users where email = 'email-d-annie@exemple.fr';

-- ── Boutique de Noël ──────────────────────────────────────

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

-- ── Box Caraïbes : prix à la pièce ──
alter table public.items add column if not exists price_cents int;

-- Gamme simple : 1,50 €
update public.items set price_cents = 150 where id in ('accras-morue', 'accras-crevette', 'samoussa-thon', 'samoussa-legumes', 'kalawang');
-- Gamme élaborée : 2,50 €
update public.items set price_cents = 250 where id in ('dize-mile', 'navette-poulet-fume', 'verrine-guacamole');
-- Gamme premium : 4 €
update public.items set price_cents = 400 where id in ('mini-bokit-poulet', 'mini-bokit-morue', 'mini-bokit-steak', 'sandwich-madras');

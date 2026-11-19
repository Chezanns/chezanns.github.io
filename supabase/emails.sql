-- Chez Ann's — ajout des e-mails automatiques
-- À lancer une seule fois dans Supabase → SQL Editor → Run
alter table public.orders add column if not exists confirm_email_sent_at timestamptz;
alter table public.orders add column if not exists ready_email_sent_at   timestamptz;

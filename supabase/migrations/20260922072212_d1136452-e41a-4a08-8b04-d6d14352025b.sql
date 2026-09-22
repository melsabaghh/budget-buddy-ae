ALTER TABLE public.transaction_entries ADD COLUMN client_id TEXT;
CREATE UNIQUE INDEX transaction_entries_user_client_id_idx ON public.transaction_entries (user_id, client_id) WHERE client_id IS NOT NULL;
ALTER TABLE public.savings_goals ADD COLUMN client_id TEXT;
CREATE UNIQUE INDEX savings_goals_user_client_id_idx ON public.savings_goals (user_id, client_id) WHERE client_id IS NOT NULL;
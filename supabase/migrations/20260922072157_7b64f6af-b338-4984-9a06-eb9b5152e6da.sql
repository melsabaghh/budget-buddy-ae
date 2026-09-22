ALTER TABLE public.categories ADD COLUMN client_id TEXT;
CREATE UNIQUE INDEX categories_user_client_id_idx ON public.categories (user_id, client_id) WHERE client_id IS NOT NULL;
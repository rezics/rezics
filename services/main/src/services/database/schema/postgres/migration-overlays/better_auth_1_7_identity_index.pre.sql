CREATE UNIQUE INDEX CONCURRENTLY accounts_issuer_account_id_key
ON public.accounts (issuer, account_id);

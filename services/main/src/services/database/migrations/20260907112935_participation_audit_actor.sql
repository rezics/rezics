SET search_path TO public;

-- PostgreSQL must commit a new enum value before the next migration can use it in constraints.
ALTER TYPE public.audit_actor_kind ADD VALUE IF NOT EXISTS 'auth' AFTER 'profile';

-- These owner tables are introduced empty by this migration. The locator is a
-- derived index and admission starts only after its control row is installed.
INSERT INTO public.catalog_routing_control(singleton, ready) VALUES (true, true);

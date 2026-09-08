-- Installation state, not imported legacy content.
INSERT INTO public.catalog_routing_control(singleton, ready) VALUES (true, true)
ON CONFLICT (singleton) DO NOTHING;

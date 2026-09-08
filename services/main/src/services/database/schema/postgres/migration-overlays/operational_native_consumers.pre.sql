-- This stopped-site owner contract is accepted on a fresh target. Existing imported
-- platform rows and private snapshots must be transferred by the separate converter.
DO 'DECLARE relation_name text; has_rows boolean;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[''account_favorite'',''account_favorite_revision'',''video'',''audio'',''post'',''poll'',''zone'',''realm'',''realm_rule'',''custom_theme'',''collection'',''tag'',''tag_path'',''label''] LOOP
    EXECUTE format(''SELECT EXISTS(SELECT 1 FROM public.%I LIMIT 1)'',relation_name) INTO has_rows;
    IF has_rows THEN RAISE EXCEPTION ''Owner-reference target is not fresh: %'',relation_name; END IF;
  END LOOP;
END';

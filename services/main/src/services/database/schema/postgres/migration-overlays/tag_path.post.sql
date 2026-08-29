-- The simple Expressions were seeded before the closure function existed.
-- Rebuild the definition-scale closure after installing canonical Tag Path SQL.
SELECT public.rebuild_tag_expression_effective_tags(expression.id)
FROM public.tag_expression AS expression
WHERE expression.status = 'active' AND expression.sealed_at IS NOT NULL
ORDER BY expression.id;

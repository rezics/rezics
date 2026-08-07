INSERT INTO public.search_best_score (snapshot_id, unit_id, score, unit_updated_at)
SELECT stat.snapshot_id, stat.unit_id, stat.engagement_24h, candidate.updated_at
FROM public.recommendation_unit_stat AS stat
INNER JOIN public.recommendation_snapshot AS snapshot
    ON snapshot.id = stat.snapshot_id
   AND snapshot.active = true
INNER JOIN public.unit AS candidate ON candidate.id = stat.unit_id
WHERE stat.context_realm_id IS NULL
  AND stat.engagement_24h > 0
ON CONFLICT (snapshot_id, unit_id) DO NOTHING;

-- Direct 1.6.0 development-preview cutover.
--
-- Production databases must first run scripts/migrate-filter-documents.ts.
-- That restartable worker performs the corpus-scale JSON and immutable-history
-- rewrites in bounded transactions. This migration is intentionally only the
-- final, short maintenance-window contract step. Fresh databases contain no
-- rows at this point and therefore pass the same proof without a backfill.

ALTER TABLE public.zone
    ADD COLUMN IF NOT EXISTS filter_document jsonb;

DO $filter_document_cutover_proof$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.zone
        WHERE filter_document IS NULL
            OR jsonb_typeof(filter_document) <> 'object'
    ) THEN
        RAISE EXCEPTION 'Zone FilterDocument backfill is incomplete'
            USING ERRCODE = '23514',
                HINT = 'Run yarn exec tsx scripts/migrate-filter-documents.ts --yes before Atlas.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.shared_search_query
        WHERE document ? 'version'
            OR document ? 'template'
            OR NOT (document ? 'filterDocument')
    ) THEN
        RAISE EXCEPTION 'Shared Search query FilterDocument backfill is incomplete'
            USING ERRCODE = '23514',
                HINT = 'Run yarn exec tsx scripts/migrate-filter-documents.ts --yes before Atlas.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.unit_dock AS dock
        WHERE dock.document @? '$.** ? (@.kind == "template")'
    ) THEN
        RAISE EXCEPTION 'A current Dock still contains a legacy Search template source'
            USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.unit_localization AS localization
        WHERE localization.content @? '$.** ? (@.kind == "template")'
    ) THEN
        RAISE EXCEPTION 'A current Block localization still contains a legacy Search template source'
            USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.revision_content
        WHERE model IN (
                'rezics.unit.main.v1',
                'rezics.unit.localization.v1',
                'rezics.dock.v1'
            )
            AND (
                payload @? '$.** ? (@.kind == "template")'
                OR payload @? '$.** ? (exists(@.boundaryDocument))'
            )
    ) THEN
        RAISE EXCEPTION 'Immutable history still contains a legacy Search or Zone document'
            USING ERRCODE = '23514';
    END IF;
END
$filter_document_cutover_proof$;

CREATE TEMPORARY TABLE obsolete_search_revision_content
ON COMMIT DROP
AS
SELECT DISTINCT content_id
FROM public.search_document_revision;

DROP TABLE public.zone_search_feature;
DROP TABLE public.search_document_revision_head;
DROP TABLE public.search_document_revision;
DROP TABLE public.search_document;

-- SearchDocument history is being removed, not archived as a hidden second
-- configuration system. Delete its now-unreferenced content blobs as well.
ALTER TABLE public.revision_content
    DISABLE TRIGGER revision_content_immutable;

DELETE FROM public.revision_content AS content
USING obsolete_search_revision_content AS obsolete
WHERE content.id = obsolete.content_id
    AND NOT EXISTS (
        SELECT 1
        FROM public.unit_revision_slot AS slot
        WHERE slot.content_id = content.id
    )
    AND NOT EXISTS (
        SELECT 1
        FROM public.dock_revision AS revision
        WHERE revision.content_id = content.id
    )
    AND NOT EXISTS (
        SELECT 1
        FROM public.content_structure_revision AS revision
        WHERE revision.content_id = content.id
    )
    AND NOT EXISTS (
        SELECT 1
        FROM public.collection_structure_revision AS revision
        WHERE revision.content_id = content.id
    )
    AND NOT EXISTS (
        SELECT 1
        FROM public.revision_content AS delta
        WHERE delta.base_content_id = content.id
    );

ALTER TABLE public.revision_content
    ENABLE TRIGGER revision_content_immutable;

DO $obsolete_search_content_proof$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM obsolete_search_revision_content AS obsolete
        JOIN public.revision_content AS content ON content.id = obsolete.content_id
    ) THEN
        RAISE EXCEPTION 'A removed SearchDocument history blob is referenced outside its owner'
            USING ERRCODE = '23503';
    END IF;
END
$obsolete_search_content_proof$;

ALTER TABLE public.zone
    ALTER COLUMN filter_document SET NOT NULL,
    DROP COLUMN boundary_document;

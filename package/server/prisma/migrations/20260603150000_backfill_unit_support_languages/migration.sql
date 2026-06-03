INSERT INTO "UnitSupportLanguage" ("unitId", "language", "isPrimary", "sortOrder")
SELECT source."unitId", source."language", false, 0
FROM (
    SELECT "unitId", "language" FROM "UnitTranslation"
    UNION
    SELECT "unitId", "language" FROM "ContentTranslation"
) AS source
LEFT JOIN "UnitSupportLanguage" AS existing
    ON existing."unitId" = source."unitId"
    AND existing."language" = source."language"
WHERE existing."unitId" IS NULL;

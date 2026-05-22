ALTER TABLE "Entity"
  ADD COLUMN "eligibleCreditRoles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "eligibleSubjectRoles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "Entity"
SET "eligibleCreditRoles" = CASE "kind"
  WHEN 'person' THEN ARRAY[
    'author', 'co-author', 'translator', 'illustrator', 'editor', 'letterer',
    'colorist', 'developer', 'composer', 'designer', 'director', 'producer',
    'writer', 'actor', 'narrator'
  ]::TEXT[]
  WHEN 'organization' THEN ARRAY[
    'author', 'co-author', 'translator', 'illustrator', 'editor', 'publisher',
    'letterer', 'colorist', 'developer', 'composer', 'designer', 'director',
    'producer', 'writer', 'studio', 'distributor'
  ]::TEXT[]
  WHEN 'studio' THEN ARRAY['developer', 'producer', 'studio']::TEXT[]
  WHEN 'label' THEN ARRAY['publisher']::TEXT[]
  ELSE ARRAY[]::TEXT[]
END,
"eligibleSubjectRoles" = CASE "kind"
  WHEN 'person' THEN ARRAY[
    'appears', 'about', 'canonical_wiki_page', 'related_subject'
  ]::TEXT[]
  WHEN 'organization' THEN ARRAY[
    'appears', 'about', 'canonical_wiki_page', 'related_subject'
  ]::TEXT[]
  WHEN 'character' THEN ARRAY[
    'primary_character', 'featured_character', 'appears',
    'canonical_wiki_page', 'related_subject'
  ]::TEXT[]
  WHEN 'faction' THEN ARRAY[
    'appears', 'setting', 'canonical_wiki_page'
  ]::TEXT[]
  WHEN 'location' THEN ARRAY['setting', 'canonical_wiki_page']::TEXT[]
  WHEN 'event' THEN ARRAY['about', 'setting']::TEXT[]
  WHEN 'concept' THEN ARRAY[
    'about', 'setting', 'source_work', 'related_subject'
  ]::TEXT[]
  ELSE ARRAY[]::TEXT[]
END;

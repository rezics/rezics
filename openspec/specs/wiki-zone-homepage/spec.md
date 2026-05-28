# wiki-zone-homepage Specification

## Purpose
TBD - created by archiving change define-realm-wiki-zone-experience. Update Purpose after archive.
## Requirements
### Requirement: Wiki Zone homepage uses built-in templates
The wiki Zone homepage SHALL render through built-in wiki homepage templates. The initial supported homepage templates SHALL include `wiki-classic-home`, `wiki-media-home`, `wiki-database-home`, and `wiki-minimal-home`. Unknown homepage templates SHALL fall back to a safe default.

#### Scenario: Classic homepage renders
- **GIVEN** a Zone config uses `homepageTemplate = "wiki-classic-home"`
- **WHEN** the wiki Zone homepage renders
- **THEN** the classic wiki homepage layout SHALL be used

#### Scenario: Unknown homepage falls back
- **GIVEN** a Zone config uses an unknown homepage template slug
- **WHEN** the wiki Zone homepage renders
- **THEN** the renderer SHALL use the default wiki homepage template

### Requirement: Homepage sections are typed and ordered
The wiki Zone homepage SHALL be configured as an ordered list of typed sections. Supported section kinds SHALL include `entityCollection`, `tagCollection`, `translationGroupCollection`, `recentWiki`, `updatedWiki`, `stubWiki`, and `manualLinks`.

#### Scenario: Homepage renders ordered sections
- **GIVEN** a homepage config contains sections `[characters, mainPages, recentWiki]`
- **WHEN** the homepage renders
- **THEN** those sections SHALL render in the configured order

### Requirement: Entity collection sections query Entities
An `entityCollection` section SHALL query Entity subjects related to the Zone's realm/wiki context. It SHALL support filters such as entity kind, subject roles, work context, realm context, sort mode, and limit. It SHALL render Entity display through Entity translations.

#### Scenario: Character section renders primary characters
- **GIVEN** a homepage section filters `entityKinds = ["character"]` and `subjectRoles = ["primary_character"]`
- **WHEN** the homepage renders for a work-backed wiki Zone
- **THEN** the section SHALL show matching character Entities in the viewer's language

### Requirement: Translation group sections feature parallel wiki pages
A `translationGroupCollection` section SHALL store `translationGroupIds`, not language-specific wiki Unit ids, when the intended content is a multilingual wiki page. Rendering SHALL select the best WIKI Post Unit in each group for the viewer's language.

#### Scenario: Featured page resolves by language
- **GIVEN** a homepage section includes `translationGroupId = "tg-artoria"`
- **AND** the group has English and Traditional Chinese WIKI Post Units
- **WHEN** a Traditional Chinese viewer opens the homepage
- **THEN** the section SHALL render the Traditional Chinese WIKI Post Unit for that group

#### Scenario: Missing language falls back
- **GIVEN** a viewer's preferred language is Korean
- **AND** translation group `tg-artoria` has no Korean WIKI Post Unit
- **WHEN** the homepage renders the group
- **THEN** the renderer SHALL select the configured fallback language variant

### Requirement: Tag collection sections use Tag Units
A `tagCollection` section SHALL store Tag Unit ids or realm tag tree references. The renderer SHALL resolve labels through Tag Unit translations and SHALL apply realm-scoped visibility and curation rules.

#### Scenario: Lore section renders translated tags
- **GIVEN** a tag collection section references `tag-lore`, `tag-timeline`, and `tag-magic`
- **WHEN** the homepage renders
- **THEN** the section SHALL display the tags using translated labels

### Requirement: Recent, updated, and stub sections query wiki Units
Recent, updated, and stub sections SHALL query WIKI Post Units sent to the Zone's realm. Stub detection SHALL use an explicit configured predicate or server-defined quality signal; it SHALL NOT infer canonical metadata from arbitrary wiki body JSON.

#### Scenario: Recent wiki section
- **WHEN** the homepage includes a `recentWiki` section
- **THEN** it SHALL list recent WIKI Post Units scoped to the Zone's realm and viewer permissions

#### Scenario: Stub wiki section
- **WHEN** the homepage includes a `stubWiki` section
- **THEN** it SHALL list wiki pages matching the configured or server-defined stub predicate

### Requirement: Homepage empty states are section-specific
Each homepage section SHALL render a section-specific empty state or hide according to its configured empty-state policy. A single empty section SHALL NOT make the entire wiki Zone homepage fail.

#### Scenario: Empty character section
- **GIVEN** a character entity collection has no matching Entities
- **WHEN** the homepage renders
- **THEN** the section SHALL follow its configured empty-state behavior
- **AND** other homepage sections SHALL still render


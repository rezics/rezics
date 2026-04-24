## MODIFIED Requirements

### Requirement: Announcements section

The homepage SHALL display an announcements section powered by the `default-realm`'s `announcement` pinboard. The section SHALL consume the pinboard list read endpoint with the viewer's current application language and SHALL render language-resolved `title` and `summary` per entry, applying the platform language-fallback precedence (requested → realm default → `en` → first available). The section SHALL NOT read from the legacy EchoKV key `home_notice`. Subtype tag chips (e.g. `公告 / 活动 / 更新`) SHALL NOT be rendered in this release.

#### Scenario: Announcements render from default-realm pinboard

- **WHEN** the homepage is loaded and `default-realm`'s `announcement` pinboard contains entries
- **THEN** the announcements section SHALL display those entries resolved into the viewer's current language

#### Scenario: No announcements available

- **WHEN** the homepage is loaded and the `announcement` pinboard is empty (after stale-id filtering)
- **THEN** the announcements section SHALL display a polished empty state or be hidden, without an error toast

#### Scenario: Language switch updates announcements in place

- **GIVEN** the homepage showing announcements in `en`
- **WHEN** the user switches the application language to `zh-Hans`
- **THEN** the announcements section SHALL re-resolve translations for the new language without a full-page reload
- **AND** entries lacking a `zh-Hans` translation SHALL fall back according to the platform fallback precedence

#### Scenario: Legacy EchoKV key is not consulted

- **WHEN** the homepage renders announcements
- **THEN** the frontend SHALL NOT issue a read for EchoKV key `home_notice`
- **AND** an existing stale `home_notice` row in EchoKV SHALL have no effect on the rendered announcements

#### Scenario: No subtype tag chips are rendered

- **WHEN** the announcements section renders any entry
- **THEN** no `公告 / 活动 / 更新` tag chip SHALL be shown

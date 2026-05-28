## ADDED Requirements

### Requirement: Realm detail includes Wiki tab
The realm detail page SHALL include a Wiki tab when wiki functionality is enabled for the realm product surface. The Wiki tab SHALL use the uniform app theme and SHALL list WIKI Post Units sent to the realm through UnitRealm.

#### Scenario: Viewer opens realm Wiki tab
- **WHEN** a viewer opens the Wiki tab for realm `realm-fate`
- **THEN** the app SHALL render a list/search surface for WIKI Post Units in that realm

### Requirement: Realm Wiki tab exposes Zone entry
When a realm has a configured wiki Zone, the Wiki tab SHALL show a prominent action at the top of the tab that opens the themed Zone page. The action label SHALL be localized.

#### Scenario: Open wiki Zone from tab
- **GIVEN** realm `realm-fate` has wiki Zone `zone-fate-wiki`
- **WHEN** a viewer clicks the Wiki tab's Zone entry action
- **THEN** the app SHALL navigate to the Zone page for `zone-fate-wiki`

### Requirement: Realm Wiki tab does not apply Zone theme
The realm Wiki tab SHALL not apply Zone-specific theme tokens. Theme customization SHALL begin only on the Zone route.

#### Scenario: Theme not applied in tab
- **GIVEN** the realm's wiki Zone uses a custom background image
- **WHEN** a viewer opens the realm Wiki tab
- **THEN** the background image SHALL NOT be applied to the realm page

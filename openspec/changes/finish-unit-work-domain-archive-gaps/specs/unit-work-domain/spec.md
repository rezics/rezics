## MODIFIED Requirements

### Requirement: Hidden Work Units Are Not Ordinary Release Pages

Hidden work Units SHALL NOT be treated as ordinary public release detail pages
for release-aware domains. Public navigation, search result rendering, shelf
item rendering, home cards, and reading flows SHALL prefer visible member Units
from `UnitWork`. Hidden work Units MAY have admin/editor surfaces and MAY
provide work-level tags, aliases, attribution, and metadata used by members.

#### Scenario: Public navigation resolves visible release

- **WHEN** a public UI surface has only a grouped work id available
- **THEN** it SHALL resolve or carry a visible release Unit destination before
  navigating
- **AND** ordinary users SHALL NOT be sent to the hidden work Unit as if it were
  a release page

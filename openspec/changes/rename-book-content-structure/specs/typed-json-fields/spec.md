## MODIFIED Requirements

### Requirement: BookIndex index schema

The contract SHALL define a `bookContentStructureNodeSchema` in `package/contract/src/book.ts` that describes the content-structure node shape used in `BookContentStructure.nodes`.

#### Scenario: Frontend iterates content-structure nodes without cast

- **WHEN** a component maps over `bookContentStructure.nodes`
- **THEN** each element has typed properties such as `title`, `chapterUnitId`, `noContent`, `rating`, and `children` without `as any`

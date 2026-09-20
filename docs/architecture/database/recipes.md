# Native recipes

Recipes are a first-stage native content and indexing domain. The
[catalog model](catalog-model.md#first-stage-compatibility) owns scope;
[shared values](../schema-modeling.md#shared-value-contracts) and
[composition](content-composition.md) own reusable semantics. This contract is
selected design; [acceptance](../../testing/recipes.md) remains unqualified.

## Identity and structure

A recipe uses a stable Resource identity, initially the generic Entity owner,
with recipe capabilities admitted through validated definitions/operations.
Adding structured storage or a Recipe classification does not change the owner
or ID. Independently maintained content can be published as a Post; a recipe may
reference that content without manufacturing a catalog release or native Work.

| Part | Required semantics |
| --- | --- |
| Names, description and attribution | Shared multilingual names/text, author/credit, source and exact change history; multiple names in one language are valid. |
| Ingredient | Optional identified food/material referent, separate from each use; unidentified source text remains valid. |
| Ingredient occurrence | Recipe/group/local occurrence ID, order, original text, optional ingredient reference and exact quantity/unit. Repeated uses are not deduplicated by ingredient ID. |
| Instructions | Ordered sections/steps with stable occurrences, authored text and optional media; instruction order is independent of ingredient identity. |
| Yield and time | Original text plus admitted structured yield/quantity and preparation/cooking/total duration where known; missing is not zero. |
| Content and publication | Revisions, drafts, context-eligible published head, disclosure and withdrawal through native content contracts. Ordinary sharing need not pin all future uses. |

Preserve ranges, fractions and qualitative quantities such as "to taste" without
inventing numeric values. A cup with an unknown measurement system cannot silently
be converted to millilitres; volume-to-mass conversion needs ingredient/density
evidence. Nutrition/dietary descriptions retain their provenance and are not
automatically derived or verified health claims.

## Operations and exchange

Support source-free creation, metadata/content editing, ingredient/step insertion,
reordering and removal, publication, read, withdrawal/restore, search and export.
Use owner-local expected-head checks and current authority. Removing one use does
not remove the underlying ingredient or another recipe's contents. Ordinary edits
retain advanced structured values they do not modify.

First-stage queries cover identity/names, author, classifications, referenced
ingredients and elected structured duration/yield predicates, with bounded pages
and explicit unknown values. Index only declared operations; arbitrary numeric or
nutrition inference is not implied by storing a value.

Map the selected [Schema.org Recipe](https://schema.org/Recipe) JSON-LD profile,
including ingredient text/structured values, instructions, yield/time and media.
Retain source observations and residual fields; report target-format losses.
Import and source-free editing use the same native commands. Full Schema.org
vocabulary-instance coverage is not a dependency of this recipe profile.

## Workload and evidence

Budget recipes, ingredient/step occurrences, revisions, source observations and
reverse ingredient indexes at the existing 500M/3B row scales. A recipe mutation
updates its own bounded state and affected projections; no full-corpus scan or
rewriting of unrelated recipes is required. Quantify occurrence/history
amplification and measure query plans during persistence verification.

Schema.org supplies exchange distinctions, not an implementation or performance
proof. The choice to reuse native values/content and admit recipe structure is a
project design decision; validate repeated uses, partial quantities, source
round-trips and denied/stale writes through the owning acceptance cases.

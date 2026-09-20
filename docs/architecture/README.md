# Architecture contracts

This directory defines the selected target system. A target contract describes
meaning, invariants, operations and evidence obligations; it does not certify that
the current checkout implements them. Actual names and installed shapes live in
[implementation reference](../reference/current-implementation.md), results in
[testing](../testing/README.md), and activation in [the plan](../plan/README.md).

## Model and ownership

- [Native modeling](schema-modeling.md): Resource identity, exact references, typed
  values, identified relations and seven declarative model contracts.
- [Standards adoption](standards-adoption.md): vocabulary, native, query, validation,
  exchange and workflow dispositions; reviewed evidence and conditional formats.
- [Database design](database/README.md), [dictionary](database/data-dictionary.md)
  and [field/storage families](database/resource-storage.md): one PostgreSQL authority,
  stable logical owners, concrete integrity and workload-driven physical layouts.
- [Product/API principles](product-design-principles.md): shared domain commands,
  capability fidelity and evidence appropriate to each claim.

## Domain contracts

| Domain | Semantic owners |
| --- | --- |
| Native recipes | [Recipe structure/operations](database/recipes.md), [first-stage domain matrix](database/catalog-model.md#first-stage-compatibility). |
| Creative catalog | [Catalog model](database/catalog-model.md), [Work/release](database/native-work.md), [creation](database/creation.md), [distribution](catalog-distribution.md), [names/authority](catalog-names-and-authority.md). |
| Content and media | [Composition](database/content-composition.md), [structure history](content-structure-history.md), [metadata-only resources](resource-metadata-only.md), [avatar/media](avatar-media.md), [Block presentation](space-presentation.md). |
| Knowledge and source data | [Semantic interoperability](semantic-interoperability.md), [source lifecycle](catalog-source-lifecycle.md), [verification](information-indexing-and-verification.md), [relationship graph](database/relationship-graph.md). |
| Classification and discovery | [Tag paths](tag-paths.md), [spoilers/measurements](classification-spoilers-and-measurements.md), [votes/references](vote-and-reference-governance.md), [filters](filter-documents.md), [feed/Space experience](filter-feed-and-zone-experience.md). |
| Space and addresses | [Space composition](space-composition.md), [routing/slug](resource-addressing.md), [presentation](space-presentation.md), [SEO](resource-landing-seo.md), [scoped delivery](realm-scoped-delivery.md). |
| Identity and governance | [Identity/access](identity-and-access.md), [connected apps](connected-apps.md), [experience](identity-and-access-experience.md), [content governance](content-governance.md), [rules](governance-rule-decisions.md), [license grants](resource-license-grants.md). |
| Participation and commerce | [Ratings](database/ratings.md), [event time](database/event-time.md), [subscriptions](subscriptions.md), [Realm policies](realm-participation-policies.md), [Studio](studio-workspace-and-contributions.md). |
| Services and operations | [Hub](database/ai-hub.md), [events](event-streaming.md), [notifications](notification-delivery-and-read-state.md), [quotas](api-quotas.md), [lifecycle](platform-native-lifecycle.md), [identity correction](native-identity-merge.md). |

## Reading rules

Resource is the common managed-object contract. Agent is a described or admitted
public actor; generic Entity is a Resource without mandatory specialized structure.
Private AuthPrincipal is separate. Realm and Zone are community and presentation
capabilities of Space. Classification, structural capability, physical placement
and authorization do not imply one another.

Capacity documents retain their explicit assumptions and dated measurements. The
[500M/3B policy](data-integrity-and-workload-budgets.md#capacity-planning) applies to
each growing relation; object counts, physical rows and throughput differ. Current
deployment is one database with separate tables. Table count, a UUID or an external
system's benchmark is not capacity qualification.

Keep a decision with its semantic owner and link consumers to it. Remove obsolete
target instructions rather than append contradictory migration notes. Preserve
source identifiers and past measurements in implementation/evidence documents;
do not rewrite history to appear to validate the new target.

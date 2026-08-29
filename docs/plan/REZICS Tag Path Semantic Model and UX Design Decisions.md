# REZICS Tag Path Semantic Model and UX Design Decisions

## Core Conclusion

If I were designing this from scratch today, I would not model `support`, `display`, and `required member` as several boolean fields directly on `tag_path_member`, nor would I make Path itself serve simultaneously as hierarchy, assertion, inference rule, and UI label.

I recommend the following layers:

> **Vocabulary Structure → Tag Expression → Path Sense → Path Application → Derived Projection → Contextual Rendering**

In other words:

* A **Tag** represents a stable concept identity.
* A **Path** represents only a structural route through the vocabulary graph.
* A **Tag Expression** represents what is actually being asserted about a Unit.
* A **Path Sense** maps the members of a Path to a Tag Expression.
* A **Path Application** records which Path Sense a Unit actually adopts.
* An **Effective Tag** is only a retrieval/inference projection.
* A **Rendered Badge** is a UI representation computed temporarily from one or more Applications according to the current page context.

What a Unit page actually displays is therefore neither an individual Tag nor a complete Path, but:

> **A contextual projection of the Tag Expression jointly supported by one or more Path Applications.**

For example:

* `TypeScript` is a simple Expression and is displayed independently as `TypeScript`.
* `Hair Color = Red` is a qualified Expression and is displayed independently as `Hair Color · Red`.
* `Eye Color = Red` is another Expression and is displayed independently as `Eye Color · Red`.
* Within a section already grouped by `Hair Color`, `Hair Color = Red` can be shortened to `Red`.

This is not a small visual-layer adjustment. It requires formally separating several kinds of semantics that are currently conflated inside Path.

In the current repository, an ordered array of Tags is the exact definition identity of `tag_path`; `tag_path_member` contains only `path_id / ordinal / tag_id`, with no assertion, qualifier, display, or inference semantics. A positive Path fit also produces support for every Path Member, while `unit_effective_tag` is a rebuildable union of direct Tags and Path-derived support.

The frontend then divides Paths and ordinary Tags into two sections: Paths use complete breadcrumbs, while ordinary Tags use bare labels. Associations receive only a Tag ID and title, which can therefore produce a semantically unhelpful `Red`.

---

## 1. What Is the Essential Problem?

The essential question is not "how many breadcrumb levels should be displayed?" It is that one Path is currently forced to perform at least four entirely different jobs:

1. **Vocabulary structure and navigation position**: where TypeScript sits in the knowledge graph.
2. **Unit assertion**: what the Unit is actually claimed to have or involve.
3. **Retrieval inference**: whether the Unit should be found when searching for a broader concept.
4. **Human-readable representation**: how much context must be shown for a person to understand it.

The discussion also contains at least four different kinds of "ambiguity" that cannot be handled by the same `requires_context` property:

* **Lexical ambiguity**: for example, the island of Java and the Java programming language, which share a name but are different concepts. This should be resolved through two Tag concepts with concept-level qualifiers.
* **Relation/slot ambiguity**: the same `Red` concept used as a hair color or an eye color. These are not two red concepts; they are two different Expressions.
* **Hierarchical-position ambiguity**: one concept appearing in multiple positions within a polyhierarchy.
* **Rendering-context ambiguity**: an Expression is complete in itself, but grouping or a page title already communicates part of its information and permits that part to be omitted.

The actual meaning of `Character → Hair Color → Red` is not "the Unit simultaneously has the three Tags Character, Hair Color, and Red." It is closer to:

$$
hairColor(Unit, Red)
$$

Likewise, for software written in TypeScript:

$$
implementationLanguage(Unit, TypeScript)
$$

Even if:

$$
TypeScript \; isA \; ProgrammingLanguage
$$

it does not automatically follow that:

$$
about(Unit, ProgrammingLanguage)
$$

Still less does it follow that the Unit itself "is a programming language." This shows that **a hierarchy between concepts and a Unit's relation to those concepts cannot be conflated through ordinary Tag fan-out**.

Mature systems also commonly separate these problems. In MeSH, one Descriptor can have multiple tree positions, actual indexing uses a particular Descriptor/Qualifier, and whether narrower terms are expanded during search is a separate retrieval option. SKOS likewise deliberately distinguishes a direct `broader` relation from the transitive closure used for query expansion. ([National Library of Medicine][1])

---

## 2. What Should Tag, Path, Path Application, and Effective Tag Each Represent?

These four concepts alone are insufficient. REZICS needs at least a **Tag Expression** and a **Path Sense** that maps a Path to an Expression.

| Object                     | Recommended semantics                                                                                                         | Must not represent                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Tag**                    | A stable, language-independent concept identity with multilingual titles, aliases, and a scope note                          | A particular Unit application, a breadcrumb, or a UI badge          |
| **Tag Path**               | An ordered vocabulary route/hierarchy position with typed edges                                                               | A claim that a Unit has every member, a complete assertion bundle, or a default display string |
| **Tag Expression**         | Structured semantics that can be applied to a Unit, such as `simple(TypeScript)` or `facetValue(HairColor, Red)`              | A complete Path or plain text concatenation                          |
| **Path Sense**             | How a Path realizes an Expression by binding Path Members to roles such as focus, slot, value, and qualifier                  | The Unit application itself                                         |
| **Path Application**       | A source fact recording that a Unit actually adopts a Path Sense under a particular authority                                 | Every global position of a Tag or the inferred set of ancestors     |
| **Direct Tag Application** | A source fact that applies a simple Expression without depending on a Path                                                     | All qualified usages                                                 |
| **Effective Tag**          | A rebuildable retrieval projection derived from direct applications, Expressions, and explicit inference rules               | The badge the UI should display or the semantic unit users vote on directly |
| **Rendered Badge**         | A representation computed from one or more Applications/Expressions under locale, surface, group, authority, and spoiler context | A persisted domain identity                                      |

The most important invariant is:

$$
Path \neq Expression \neq Application \neq EffectiveTag \neq Badge
$$

Where:

$$
Application = Unit + Authority + PathSense
$$

$$
PathSense = Path + ExpressionBinding
$$

$$
EffectiveTags = f(AcceptedApplications,\ DirectApplications,\ ExplicitInferenceRules)
$$

$$
Badge = Render(Group(Applications),\ RenderContext)
$$

MeSH separates Descriptor identity, tree location, Descriptor/Qualifier indexing expressions, and retrieval expansion. Wikidata separates item identity from a property-value statement, which can further carry qualifiers, references, and rank. Both support the conclusion that concept identity is not the same thing as a statement constructed using that concept. ([National Library of Medicine][1])

---

## 3. Which Semantic Properties Does a Path Member Need, and Why?

My conclusion is:

> **`tag_path_member` itself should not have general-purpose `support:boolean` and `display:boolean` fields.**

The core data for a Path Member should remain minimal:

* `path_id`
* `ordinal`
* `node_id`
* the typed relation/edge to the preceding node

However, a Path should no longer be limited to assertable Tags. The cleanest long-term model is to introduce a unified `VocabularyNode`:

* `concept node`: corresponds to a Tag, can be indexed, and can be used as an Expression argument.
* `guide node`: used only for organization and navigation; it is not a concept and cannot be applied or receive support.

This does not create a separate VNDB Trait system. It permits two node semantics within the same vocabulary graph. A Getty AAT Guide Term creates a grouping level where no suitable concept exists, and the official rules explicitly state that Guide Terms are not available for indexing or cataloging. SKOS similarly defines Collections used for node labels as disjoint from Concepts. ([Getty][2])

Adjacent Path relationships also need typed edges. They should at least distinguish:

* generic/is-a;
* partitive/part-of;
* instance;
* organizational;
* facet/slot-value relationships.

The Getty vocabularies formally distinguish generic, partitive, instance, and other hierarchy relationship types because their transitivity and semantic consequences differ. ([Getty][3])

Roles that genuinely concern an Application should live on the **Path Sense/Expression binding**, not directly on the Path Member:

| Concern                           | Owner                            | Example                                      |
| --------------------------------- | -------------------------------- | -------------------------------------------- |
| Whether a node is in the Path     | Path Member                      | `Appearance` is at ordinal 1                 |
| Relation to the preceding node    | Path Edge                        | `Red` is an allowed value of `Hair Color`    |
| Expression focus/value            | Path Sense binding               | `Red` is the value                           |
| Expression slot/predicate         | Path Sense binding               | `Hair Color` is the slot                     |
| Components required in isolation  | Expression label signature       | `[Hair Color, Red]`                          |
| Grouping key                      | Expression presentation metadata | `Hair Color`                                 |
| Primary assertion                 | Expression                       | `Hair Color=Red`                             |
| Concepts that can be inferred     | Explicit inference rule          | May infer `Character Traits`                 |
| Search-only expansion             | Retrieval rule                   | Find when searching `Red` or `Appearance Traits` |
| Breadcrumb fallback               | Path                             | Complete route                               |

A single role enum is also insufficient because one member can simultaneously be:

* the Expression's slot;
* a UI qualifier;
* a grouping key;
* a search filter key.

An inference output may not even be a Path Member. For example, an Expression can explicitly imply `Frontend Development` even if `Frontend Development` is not in the original Path. This further demonstrates why `support:boolean` should not be a Path Member property.

---

## 4. How Should Display Semantics Be Separated from Inference/Support Semantics?

The two should be completely separate in the data model, but they should not be unconstrained arbitrary combinations of booleans. Both should trace back to the same Expression.

I recommend splitting today's broad notion of support into four layers:

| Layer                   | Meaning                                                 | Can users vote on this fact?                      |
| ----------------------- | ------------------------------------------------------- | ------------------------------------------------: |
| **Primary assertion**   | The complete Expression directly claimed by an Application | Yes, through Application fit                   |
| **Entailed assertion**  | Derived through explicit, governed semantic rules       | Usually not separately; preserve its source       |
| **Retrieval expansion** | Expanded at query time to improve recall                 | No                                                |
| **Navigation context**  | Used only for hierarchy/browsing                         | No                                                |

A positive Path fit should therefore support:

> "This Unit matches this Tag Expression."

Not:

> "This Unit received a positive vote for every Tag in the Path."

For example, this Path:

`Programming → Programming Languages → TypeScript`

could be configured as:

* Primary assertion: `simple(TypeScript)` or `implementationLanguage(TypeScript)`.
* `Programming Languages`: a slot, category, or navigation node that receives no Unit support.
* `Programming`: becomes an inferred result only when an explicit, governed entailment/retrieval rule exists.
* UI label: `TypeScript`.
* Full breadcrumb: expanded only in Path detail or a popover.

The VNDB API separates these layers clearly: Tags returned for a VN are only the directly applied Tags, without parent Tags; a `tag` search matches parents, while `dtag` matches only direct Tags. Traits make the same distinction through `trait` and `dtrait`. ([VNDB API][4])

MeSH follows the same basic principle. Documents are indexed with specific Descriptors/Qualifiers, while PubMed's default search can "explode" to narrower descriptors; `noexp` disables that expansion. ([National Library of Medicine][5])

SKOS more directly treats `broader` as a direct relation and `broaderTransitive` as an inference closure, noting that the transitive closure is suitable for query expansion rather than as a replacement for direct assertions. ([W3C][6])

Danbooru likewise does not automatically inherit a Tag merely because it sits in an implied hierarchy. It models implications as explicit, directed, governable edges and checks them for cycles and redundant transitive relations.

Another important consequence is that a Profile's negative vote on bare `Red` and its positive vote on the `Hair Color=Red` Path should not necessarily be treated as a conflict. They may be different assertions. Deduplication or conflict handling is necessary only when they ultimately map to the same Expression/claim key.

---

## 5. How Can Self-Describing and Context-Dependent Tags Be Unified?

A global `requires_context` property should not be added to Tag.

Instead, this should be determined by the **standalone semantic label signature of the Tag Expression**.

For example:

| Expression                       | Standalone signature | Standalone display  |
| -------------------------------- | -------------------- | ------------------- |
| `simple(TypeScript)`             | `[TypeScript]`       | `TypeScript`        |
| `simple(Mystery)`                | `[Mystery]`          | `Mystery`           |
| `facetValue(HairColor, Red)`     | `[Hair Color, Red]`  | `Hair Color · Red`  |
| `facetValue(EyeColor, Red)`      | `[Eye Color, Red]`   | `Eye Color · Red`   |

A deep Path:

`Character Traits → Appearance → Head → Hair → Hair Color → Red`

can still map to:

`facetValue(HairColor, Red)`

Its standalone display therefore remains:

`Hair Color · Red`

rather than the complete Path.

Two kinds of qualifier must be distinguished here:

### Concept-Level Qualifier

Used for identically named but distinct concepts, for example:

* Java (programming language)
* Java (island)

This belongs in the Tag concept identity/label.

### Expression-Level Qualifier

Used when the same concept occupies different slots, for example:

* Hair Color · Red
* Eye Color · Red

Here, `Red` remains a single Tag.

Getty AAT qualifiers are primarily used to distinguish homographs. Its guidance specifically states that qualifiers should not express compound concepts; compound concepts should retain their component concepts and combine them during indexing or application. This directly supports REZICS retaining `Red` as one concept and expressing `Hair Color=Red` through an Expression. ([Getty][7])

VNDB Traits apply a stricter product rule: Trait names are not necessarily self-describing, so the official API requires them always to be displayed with their top-level group. REZICS should not copy this as "display the group for every Trait," but generalize it into each Expression's own minimal standalone signature. ([VNDB API][4])

---

## 6. How Should the Unit Page and Tag Card Behave When a Tag Has Multiple Paths?

The following must be explicitly distinguished:

* **All global hierarchy positions of a Tag**.
* **The Path Applications actually adopted by this Unit**.

Badges on the Unit page are produced only from the latter. After a badge is clicked, its popover is divided into two areas:

### "Applications on This Unit"

At the top, show the actual sources that formed this badge:

* Path Application;
* direct application;
* authority;
* fit/spoiler;
* provenance;
* the complete breadcrumb, expandable when necessary.

### "Other Positions of This Tag"

Show the Tag's other positions in the global vocabulary graph in a collapsed section, explicitly marking that they **are not adopted by this Unit**.

When a Unit actually adopts two Paths:

#### Both Paths Map to the Same Expression

For example:

* `Character → Hair Color → Red`
* `Character Traits → Appearance → Hair Color → Red`

Both map to `Hair Color=Red`.

The Unit Overview displays one:

`Hair Color · Red`

The popover displays:

`2 application sources`

and lists both complete Paths. Voting controls still target each individual Application, not the merged badge.

#### The Paths Map to Different Expressions

For example:

* `Hair Color=Red`
* `Eye Color=Red`

They are displayed as two independent semantic items, preferably grouped as:

* Hair Color: Red
* Eye Color: Red

#### Two Expressions Happen to Render as the Same String

They must not be merged by string. The renderer must restore more qualifier, relation-label, or authority-label information until they can be distinguished.

The badge aggregation key should therefore be:

$$
(authority,\ expressionId)
$$

not:

$$
renderedText
$$

Both MeSH and Getty AAT allow one concept to appear in multiple hierarchy positions. Getty even allows multiple parents, designating only one preferred parent for default presentation while other parents remain valid for retrieval. This supports the distinction that multiple positions are real structure while the default display is only a presentation choice. ([National Library of Medicine][1])

I do not recommend permanently elevating one Path to a semantic `primaryPath` for a concept in REZICS. When a breadcrumb is needed, prefer a Path actually adopted by the current Unit. When there is no Unit context, use replaceable presentation ranking and show "N other positions."

---

## 7. How Much Path Information Should Overview, Associations, Search, Picker, and Tag Detail Display?

The common pattern in mature faceted UIs is not to place the entire hierarchy into every result. Instead, facet headings, current selections, breadcrumbs, and grouping jointly provide context, disclosing the next level progressively. Getty search results similarly use a preferred term with a shortened parent string, leaving the complete hierarchy for the detail page. ([Flamenco at Berkeley][8])

I recommend the following rules for each surface:

| Surface                        | Default display                                                                                               | When the complete Path appears             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **Unit Overview**              | Expression projections of direct/Path Applications; aggregate facet-like items by group                      | After clicking a badge                     |
| **Associations preview**       | The most compact `group: value1, value2`, limited to one or two lines                                         | In a popover or Associations detail page   |
| **Search result: Unit**        | A match reason such as `Matched: Hair Color · Red`, clearly labeled direct/inferred                           | Expand "Why this matched"                 |
| **Search result: Tag concept** | Tag title, scope summary, and minimal context; for multiple positions, show `N other positions`              | Tag detail                                 |
| **Tag Picker**                 | The user selects an Expression/Path Sense rather than an ambiguous bare Tag; show `Hair Color · Red` at a glance | Hover/expand to show the complete Path   |
| **Tag Badge Popover**          | First show the Unit's actual Applications, then other global positions                                       | Expand an Application row                  |
| **Tag Detail**                 | Center the Tag concept; separately list direct usages, qualified expressions, all positions, and inferred reach | Complete structure in the Paths section  |
| **Path Detail/Explorer**       | Complete breadcrumb, typed edges, guide nodes, Path Senses, assertion outputs, and inference rules           | Complete presentation is normal here       |
| **Curation UI**                | Show structure, Expression binding, label signature, and inference rules together                            | Do not omit information                    |

The Picker should not continue applying the general rule "silently apply the only ending Path." One-click application is acceptable only when the search result is unique, the Expression is unambiguous, and the UI clearly presents the semantics that will be applied. Otherwise it should present a choice:

* `Red`

  * Hair Color · Red
  * Eye Color · Red
  * Other qualified usages

---

## 8. What Should the Formal Rendering Rules for Grouping/Aggregation Be?

The proposed direction:

$$
renderedLabel = requiredMembers - informationAlreadyExpressedByContext
$$

is sound, but `requiredMembers` must become the **semantic label components of the Expression**. It cannot be a set subtraction directly over Path Members.

### Definition

For an Expression (e) and locale (l), define:

$$
Sig(e,l)=[c_1,c_2,\ldots,c_n]
$$

This is the ordered list of component IDs sufficient to express the Expression's semantics without any external context.

For example:

$$
Sig(hairColorRed,zh)=[hairColor,red]
$$

Render Context (C) is not a set of text strings. It consists of semantic components/roles already expressed explicitly by the page:

* group heading;
* section authority;
* applied filter;
* current Path Explorer node;
* association role;
* parent card title.

### Formal Algorithm

#### 1. Apply Visibility Filtering First

First filter Applications by authority, permissions, spoiler state, and content label. Only visible sources can form a badge.

#### 2. Aggregate by Semantics First

If two sources satisfy:

$$
authority(a)=authority(b)
$$

and:

$$
expression(a)=expression(b)
$$

aggregate them into one presentation item while preserving every Application ID and provenance record.

Different authorities are not merged automatically.

#### 3. Select a Group

An Expression can declare a semantic `groupKey`, such as `Hair Color`.

The group must not be guessed from the "first ancestor" or "most common parent." Only a member explicitly declared by the Expression as a facet/slot/group key may be used as the grouping key.

If the renderer displays:

**Hair Color**

then add `Hair Color` to (C).

#### 4. Perform Contextual Subtraction

$$
Residual(e,C)=Sig(e)-C
$$

This operation has three constraints:

* Remove a component only when both semantic ID and role match.
* Preserve at least one value/focus component.
* Do not remove a component merely because its text matches.

Therefore:

$$
Sig=[aa,bb,cc], \quad C=\{aa\}
$$

produces:

$$
[bb,cc]
$$

which yields exactly:

`bb · cc`

#### 5. Repair Collisions

If two different Expressions have the same residual label within the same visible set, restore information in this order:

1. the most recently omitted semantic qualifier;
2. the fallback qualifier defined by the Expression;
3. a distinguishing Path ancestor;
4. an authority/relation label;
5. only then, the complete breadcrumb.

Select the first candidate that distinguishes non-equivalent Expressions.

The complete formula can be written as:

$$
Render(e,C,V)=FirstUnique(
Residual,\ RestoreQualifier,\ AddFallback,\ FullPath
)
$$

where (V) is the set of Expressions visible on the same screen.

### Examples

Ordinary card:

`aa · bb · cc`

Already grouped by `aa`:

**aa**

* `bb · cc`

For hair color and eye color:

**Hair Color**

* Red
* Black

**Eye Color**

* Red
* Blue

For compact badges without grouping:

* Hair Color · Red
* Eye Color · Red

These rules can serve Overview, Associations, Search, Picker, and Popover alike. The only differences are the (C) supplied by each surface, its available space, and its fallback depth.

---

## 9. Should Path Identity Include Configuration?

The answer is not simply "yes" or "no," because what is currently called configuration mixes several different kinds of data.

The layers should be separated as follows:

| What changes                              | What new identity should be created          |
| ----------------------------------------- | -------------------------------------------- |
| Ordered node sequence                     | New Path                                     |
| Typed edge sequence/edge semantics        | New Path                                     |
| The same Path is interpreted as a different proposition | New Tag Expression/Path Sense     |
| Focus/slot/predicate                      | New Expression/Path Sense                    |
| `Hair Color · Red` changes to a synonymous display template | Same Expression, new presentation revision |
| Separator, abbreviation, or ellipsis      | Renderer policy change                       |
| Inferred output                           | Inference rule revision                      |
| Locale title or translation               | Same concept and Expression                  |
| Ranking/usage count                       | Aggregate update; no identity change         |

I therefore recommend:

### Path Identity

Determined by:

$$
ordered\ node\ sequence + typed\ edge\ sequence
$$

It does not include configuration such as support, display, ranking, or usage.

### Tag Expression Identity

Determined by a structured proposition, for example:

$$
facetValue(hairColor,red)
$$

or:

$$
simple(TypeScript)
$$

### Path Sense Identity

Determined by:

$$
Path + Expression + memberRoleBinding
$$

One Path can have multiple Path Senses, but this should be uncommon and should occur only when the same structural route genuinely has different application semantics.

### For the Proposed Configurations A and B

If A and B differ only in:

* which members are displayed;
* whether certain ancestors are included in search;

then they are not two Paths and are not necessarily two Path Senses. Those differences belong in the presentation definition and inference rules, respectively.

They become two Path Senses/Expressions only when A and B express different Unit propositions.

This layering has the following effects:

* **uniqueness**: UI redesigns do not fragment Paths.
* **governance**: structural Paths, Expressions, and inference rules are reviewed separately.
* **voting**: a Path vote evaluates whether the route is valid; Application fit evaluates whether a Unit matches the Expression.
* **merging**: Path merges and Expression merges remain separate.
* **history**: semantic changes do not overwrite old Applications.
* **application identity**: an Application points to an immutable Path Sense.
* **cache**: a label cache can use `expressionRevision + locale`, while a Path cache uses the Path ID.
* **popularity**: Expression usage and Path usage are measured separately.
* **URL**: Path URLs remain stable; Expression/Sense addresses can exist separately where necessary.
* **conflict resolution**: disputes can be located explicitly in structure, semantics, inference, or display.

---

## 10. Which Conclusions Come from Mature Systems, and Which Are My Deductions?

| System/research                  | Direct conclusion                                                                                                                                                                                   | REZICS-specific deduction                                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **VNDB Tags/Traits**             | Tags/Traits form a DAG; searching a parent can match children, but entries return directly applied Tags; Trait names may not be self-describing and are therefore displayed with their group. ([VNDB API][4]) | There is no need to split Tags and Traits into separate products; the group can be generalized into each Expression's standalone signature. |
| **MeSH**                         | A Descriptor can have multiple tree positions; Descriptor/Qualifier is the indexing unit; search can explode narrower terms or disable expansion; complex topics can use Descriptor combinations or Descriptor/Qualifier. ([National Library of Medicine][1]) | Path position, indexing Expression, and retrieval expansion should be different objects.                         |
| **SKOS**                         | Concept, label, semantic relation, and Collection are separate; direct broader relations are separate from transitive closure; polyhierarchy/alternative paths are valid; a Collection can provide a node label but is not a Concept. ([W3C][6]) | REZICS should have concept nodes and guide nodes, and hierarchy closure must not become a Unit assertion.          |
| **ISO 25964**                    | The standard treats thesaurus concepts, terms, relations, facet analysis, presentation, and data model as separate concerns for information retrieval rather than as a simple UI tree. ([ISO][9]) | REZICS should not use one Path Member role to carry all semantics.                                                 |
| **Getty AAT**                    | Guide Terms are organizational only and unavailable for indexing; hierarchy edges have generic/partitive/instance types; multiple parents are supported; horizontal displays generate and shorten parent strings. ([Getty][2]) | Paths should have typed edges; complete breadcrumbs should appear mainly in detail/explorer views; compact labels should be separate projections. |
| **LCSH**                         | A pre-coordinated heading string can retain context between concepts, improving precision/browseability, while also being machine-decomposable for post-coordinate search. ([Library of Congress][10]) | `Hair Color · Red` should render a structured Expression, rather than making the string itself or the complete breadcrumb an identity. |
| **Wikidata**                     | Concept/item and statement are separate; a statement consists of property-value and can carry qualifier, reference, and rank. ([Wikidata][11]) | `Hair Color=Red` should be treated as a proposition, not as a UI alias of the bare `Red` Tag.                      |
| **Danbooru**                     | Tag implications are explicit, directed, governable rules that are checked for cycles and redundant transitive relations.                                                                          | REZICS ancestor inference should come from explicit rules rather than Path-wide fan-out.                          |
| **Faceted-navigation research**  | Facet names, current selections, hierarchical breadcrumbs, and progressive drill-down jointly express context; results can be grouped under a selected facet to avoid repetition. ([Flamenco at Berkeley][8]) | `signature - render context + collision repair` is a reasonable unified renderer.                                |

The following parts are not answers supplied directly by any single standard. They are designs I derived specifically for REZICS:

* Tag Expression;
* multiple Paths realizing the same Expression;
* Path Sense as the binding from Path to Expression;
* Expression-based badge aggregation;
* formal contextual subtraction;
* a collision-repair ladder;
* separate layers for Path identity, Expression identity, presentation revision, and inference revision;
* displaying Applied Expressions rather than Effective Tags on Unit pages.

---

## 11. Final Recommended Data Model and UX Model

### 11.1 Semantic Flow

```text
Tag / Guide Node
        │
        ├── typed relations ──> Tag Path
        │                         │
        │                         └── Path Sense ──> Tag Expression
        │
Unit + Authority + Path Sense ──> Path Application
Direct Tag Application ─────────> Simple Tag Expression

Accepted source applications
        └──> Unit Expression Assertion
                  ├──> Explicit inference / retrieval projections
                  │         └──> Unit Effective Tags / Search index
                  └──> Render context
                            └──> Badge / Group / Popover
```

### 11.2 Conceptual Relational Model

This is a semantic schema, not a SQL implementation plan.

#### Vocabulary Structure

* `vocabulary_node`

  * `id`
  * `kind = concept | guide`
* `tag`

  * `node_id`
  * concept identity, scope note, lifecycle
* `guide_node`

  * `node_id`
  * organizational name, lifecycle
* `tag_relation`

  * `parent_node_id`
  * `child_node_id`
  * `relation_kind`
  * provenance/governance

#### Path Structure

* `tag_path`

  * immutable ID
  * structural identity hash
* `tag_path_member`

  * `path_id`
  * `ordinal`
  * `node_id`
  * incoming edge/relation reference

Path Member contains neither `support` nor `display`.

#### Expression Structure

* `tag_expression`

  * immutable semantic ID
  * `expression_kind`
  * canonical claim key
  * focus/value concept
* `tag_expression_argument`

  * `expression_id`
  * `role = predicate | slot | value | focus | qualifier`
  * concept ID
* `tag_expression_label_component`

  * `expression_id`
  * locale-specific or language-independent component reference
  * ordinal
  * presentation role
* `tag_expression_group_key`

  * `expression_id`
  * slot/facet component
* `tag_expression_inference_rule`

  * source Expression
  * target Tag/Expression
  * `kind = entailed | retrieval_only`
  * provenance, status, revision

#### Path-to-Expression Mapping

* `tag_path_sense`

  * immutable ID
  * `path_id`
  * `expression_id`
  * member-role binding signature
  * lifecycle, provenance
* `tag_path_sense_binding`

  * sense ID
  * Path Member ordinal
  * Expression argument role

#### Unit Source Facts

Logically:

* `unit_direct_tag_application`
* `unit_tag_path_application`
* corresponding judgments/fit/spoiler/provenance

A Path Application points to `path_sense_id`, not only to a bare `path_id`.

Global and Realm must retain the authority key. A Realm can adopt a global Path Sense but cannot silently alter its semantics under the same ID. If a Realm requires a different interpretation, it should create a Realm-scoped Sense. REZICS already deliberately separates Global and Realm Path adoption, application, and vote populations; the new projection should preserve this distinction.

#### Rebuildable Projections

* `unit_expression_assertion`

  * aggregate direct and Path sources for the same Unit/authority/Expression
* `unit_effective_tag`

  * direct, primary-expression, entailed, and retrieval evidence counts
* search documents/facet indexes
* usage/ranking aggregates

#### Data That Should Not Be Persisted

* rendered badge;
* the concatenated `Hair Color · Red` string;
* a residual label after render context has been subtracted;
* a group on a particular screen;
* the "currently shortest but unique" breadcrumb.

All should be derived from the definition cache and the current render context.

### 11.3 Scale Implications

Under the current model, a positive fit expands all member support for every Profile according to Path length (L). The capacity documents also explicitly model write amplification as growing with (L), with support tables planned for hundreds of millions or billions of rows and very high WAL pressure.

The new model's fan-out should depend on the number (A) of explicit assertion/inference outputs:

$$
O(L) \rightarrow O(A)
$$

where typically:

$$
A=1
$$

For example, the primary source fact for `Hair Color=Red` is one Expression assertion rather than support for four to six Path Members.

Ancestor query expansion should preferably occur in:

* a definition-scale closure cache;
* search-engine filter expansion;
* bounded query-time expansion;

rather than through one support row for every Profile, Unit, and Path Member.

Path Sense, Expression, label component, and inference rule are all definition-scale relations and are very small compared with Unit application/judgment tables. Reading a Unit requires only:

1. a bounded read of its actual Applications;
2. batch hydration of Path Sense/Expression definitions;
3. aggregation by Expression;
4. rendering.

The request path does not need to traverse the entire graph.

### 11.4 Migration Principles

Tag Path is currently only a dev preview that has never been formally released. Its existing Path schema, data, and behavior therefore do not constitute a supported compatibility contract. This cutover should use a **one-time destructive replacement**: optimize for the correct final model, without providing data migration or compatibility layers for old Path data, old voting semantics, or old API/UI behavior.

This does not permit rewriting migration history. Existing migration files still must not be edited, deleted, or renamed. The destructive change must be implemented by a new forward migration whose filename sorts after them. That migration may directly drop or recreate tables, columns, constraints, projections, and data owned by the dev preview. It may also clear Path Applications, judgments, support records, and derived indexes that cannot be valid under the new semantics.

The design should follow these principles:

1. Do not backfill old Path Senses or guess which Expression an existing member sequence represents. Recreate or reseed new Paths, Expressions, and Path Senses under the new model.
2. Do not preserve existing Unit–Path Applications, judgments, provenance, or all-member support. They are dev-preview data from an unreleased model and cannot be reinterpreted as user assertions in the new model.
3. Do not implement dual write, dual read, shadow projections, parity comparison, legacy display fallbacks, compatibility aliases, redirects, or removal guards. The schema, backend reads and writes, search/inference projections, and UI should switch directly to the new model in one coordinated cutover.
4. Explicitly make old binaries incompatible with the new schema during the cutover. Development and test environments that still contain old data should apply the new destructive forward migration or rebuild the database instead of running row-by-row data conversion.
5. After migration, rebuild search documents, facet indexes, caches, and usage aggregates from the new source of truth. These rebuildable projections must not inherit from legacy support.
6. Limit destructive scope to the unreleased Tag Path contract and its owned/rebuildable data. Any released data or contract not owned by Path remains subject to normal release and migration protections.

The cutover acceptance criteria are:

* A blank database can replay the complete migration history and arrive at the new final schema.
* A database containing the old dev-preview Path schema/data can apply the new forward migration without retaining old tables, columns, projections, or execution paths.
* The new model's seeds, constraints, projection rebuilds, and core semantic tests pass.
* The repository contains no runtime fallback or compatibility code retained for the old Path contract.
* The destructive migration neither deletes nor rewrites released data outside its scope.

### 11.5 Final Behavior of Required Examples

| Example                                                        | Final semantics and UI                                                                                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **A**: Apply only `Character Traits→Appearance→Hair Color→Red` | Expression=`Hair Color=Red`; Overview displays `Hair Color · Red`; the complete Path appears in the popover                     |
| **B**: Apply both red hair color and red eye color              | Two Expressions; grouped as `Hair Color: Red` and `Eye Color: Red`                                                              |
| **C**: TypeScript has multiple global Paths, but the Unit applies only one | Overview displays `TypeScript`; "Applications on This Unit" in the popover lists only one; the other Paths appear under "Other Positions" |
| **D**: `aa→bb→cc` is the standalone signature and the screen is already grouped by aa | group heading=`aa`; child label=`bb · cc`                                                                         |
| **E**: Intermediate nodes cannot become Unit assertions         | Intermediate nodes remain in the Path without support; use a retrieval-only rule if they should match in search                 |
| **F**: The same member sequence has two candidate configurations | It remains one structural Path; display changes are presentation revisions, inference changes are rule revisions, and only different assertion meanings create another Expression/Path Sense |
| **G**: Global and Realm Paths are visible together              | Separate sections/chips by authority; do not merge vote populations; do not aggregate same-label badges across authorities     |

---

## 12. Explicit Trade-Offs Against Other Candidate Designs

| Design                                                       | Advantages                                                                                           | Main problems                                                                                                                   |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Path Member `support/display` booleans**                   | Easiest to attach to the current schema                                                              | Cannot express a property-value proposition; permits many meaningless combinations; inference outputs can only be Path Members; display and semantic versions become entangled |
| **Single role enum**                                         | Appears cleaner than booleans                                                                        | One member is often simultaneously a slot, qualifier, and group key; the roles are not mutually exclusive                      |
| **Global `Tag.requiresContext`**                             | Simple UI implementation                                                                             | Whether context is needed depends on Expression, locale, and surface, not on a global property of Tag                           |
| **Complete breadcrumb on every surface**                     | Less likely to omit information                                                                      | Extremely noisy; deep Paths do not suit Overview/Associations; assertion fan-out remains unresolved                             |
| **Automatically select the shortest unique ancestor**        | Less curation work                                                                                    | "Unique" does not mean "semantically sufficient"; graph and translation changes cause label drift; unstable under polyhierarchy |
| **Separate Tag/Trait/Facet systems**                          | Each domain can have specialized UX                                                                  | Duplicates concept identity, API, governance, and search; difficult to unify across Unit types                                   |
| **Path sequence + all configuration jointly define identity** | Every configuration is immutable and easy to cache                                                   | Small UI or inference changes create new Paths, fragmenting votes, usage, URLs, merges, and history                             |
| **Path sequence-only, with in-place mutable configuration**   | Stable ID                                                                                            | Old Application semantics drift with configuration, making history and caches untrustworthy                                    |
| **Structural Path + Expression + Path Sense**                | Clearest semantic boundaries; supports mixed models, polyhierarchy, aggregation, Realm, and explicit inference; can reduce fan-out | Adds a definition layer, curation UI, API projections, and migration complexity                                             |

The main cost of the recommended model is indeed the addition of two concepts: `Tag Expression` and `Path Sense`. However, this complexity already exists. It is merely hidden today inside Path fan-out, complete breadcrumbs, bare Tags, Picker guesses, and frontend special cases. Modeling it explicitly converts implicit and unverifiable complexity into complexity that can be governed, tested, and observed.

## Final Decision

REZICS should ultimately adopt a unified vocabulary/Tag Path system, but Path must no longer be the "container for all semantics."

The four most important principles are:

1. **Path membership never automatically equals a Unit assertion.**
2. **A Unit page displays Applied Tag Expressions, not Effective Tags or complete Paths.**
3. **Display, assertion, inference, and navigation must be separate model layers; they cannot be compressed into one role or two booleans on Path Member.**
4. **Path identity remains structural; semantic configuration belongs in Expression/Path Sense, while display and inference are versioned independently.**

Under this model, `Hair Color · Red` is no longer a string temporarily assembled by the UI to compensate for a bare `Red`. It is the minimal standalone representation of a formal Expression, `Hair Color=Red`. The complete `Character Traits→Appearance→Hair Color→Red` returns to the roles it is actually suited for: navigation, curation, source explanation, and the Path Explorer.

[1]: https://www.nlm.nih.gov/mesh/intro_trees.html "https://www.nlm.nih.gov/mesh/intro_trees.html"
[2]: https://www.getty.edu/publications/vocabularies-editorial-guidelines/aat-guidelines/3_editorial_rules/3.1/ "https://www.getty.edu/publications/vocabularies-editorial-guidelines/aat-guidelines/3_editorial_rules/3.1/"
[3]: https://www.getty.edu/publications/vocabularies-editorial-guidelines/ulan-guidelines/3_editorial_rules/3.1/ "https://www.getty.edu/publications/vocabularies-editorial-guidelines/ulan-guidelines/3_editorial_rules/3.1/"
[4]: https://api.vndb.org/kana "https://api.vndb.org/kana"
[5]: https://www.nlm.nih.gov/mesh/intro_retrieval.html "https://www.nlm.nih.gov/mesh/intro_retrieval.html"
[6]: https://www.w3.org/TR/skos-reference/ "https://www.w3.org/TR/skos-reference/"
[7]: https://www.getty.edu/publications/vocabularies-editorial-guidelines/aat-guidelines/3_editorial_rules/3.3/ "https://www.getty.edu/publications/vocabularies-editorial-guidelines/aat-guidelines/3_editorial_rules/3.3/"
[8]: https://flamenco.berkeley.edu/papers/faceted-workshop06.pdf "https://flamenco.berkeley.edu/papers/faceted-workshop06.pdf"
[9]: https://www.iso.org/standard/53657.html "https://www.iso.org/standard/53657.html"
[10]: https://www.loc.gov/catdir/cpso/pre_vs_post.html "https://www.loc.gov/catdir/cpso/pre_vs_post.html"
[11]: https://www.wikidata.org/wiki/Help%3AStatements "https://www.wikidata.org/wiki/Help%3AStatements"

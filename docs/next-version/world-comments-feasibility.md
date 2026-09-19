# World comments: logical feasibility and commercial value

## Decision

Within verified Minecraft and other supported game environments, an integrated REZICS spatial discussion feature is logically feasible. Existing annotation models, working location-note systems and commercial map-discussion products support its principal components. The strongest near-term commercial case is increasing the usefulness of existing REZICS content and community participation, followed by tools for the people who maintain that content. A standalone world-message network or renderer marketplace is a weaker starting proposition.

Proceed with the [next-version feature plan](world-comments.md) as an integrated view over shared publications in verified environments. The design needs explicit recipe/instance meaning, publication-to-anchor bindings, social layers, language/provenance preservation and readable presentation fallbacks. Its commercial sequence should start with existing game/Wiki communities and repeatedly visited shared worlds, then evaluate maintainer subscriptions and selected Earth communities.

The evaluation concerns logical coherence and commercial value. Verified game environments are an input assumption; automatic support for unknown servers or arbitrary mod combinations is not a requirement. The separately developed game with full native support is outside this assessment and is not a dependency. Complex performance testing is not required for this research. Basic workload reasoning is retained only to avoid structurally unbounded designs; no local benchmark, interoperability trial or business conversion result is claimed.

## Commercial value

### Existing products establish the category, not REZICS revenue

| Primary evidence | What it establishes | What REZICS should infer |
| --- | --- | --- |
| [ArcGIS Hub discussion boards](https://doc.esri.com/en/arcgis-hub/latest/collaborate/use-discussion-boards.html) offer map, grid and list presentations, posts/replies and channel participation controls. | Integrated spatial discussion is a concrete existing product pattern, not only a speculative interface. | Reuse content identity and separate presentation from community participation; do not claim that combining a map and forum is unprecedented. |
| [ArcGIS Hub purchase options](https://www.esri.com/en-us/arcgis/products/arcgis-hub/purchase-options) place community engagement and map discussions in a Premium offering requiring an additional annual subscription. | An established vendor markets this bundle to organizations as paid collaboration infrastructure. | Organizational workflow is a credible payer hypothesis; Esri's GIS customers do not establish consumer-game willingness to pay. |
| [Discourse pricing](https://www.discourse.org/pricing) lists free hosting, Pro at USD 100/month and Business at USD 500/month, with progressively broader management/integration features. | Hosted community operations have observable paid offerings and substantial free alternatives. | Charge for ongoing operational value if demonstrated; a new forum or map tab alone is insufficient. These prices are comparators, not a REZICS pricing recommendation. |
| The developer's [MapGenie Genshin listing](https://play.google.com/store/apps/details?id=io.mapgenie.genshinmap) describes map search, completion tracking, personal notes and Web synchronization, and declares in-app purchases. | Location-based game assistance has an established consumer product format and a monetized offering. | Players have recognizable practical jobs around locations. The listing does not disclose conversion, revenue or a verified current PRO price; dated user-review prices are not used. |

The defensible differentiation hypothesis is the combination of version-aware game context with REZICS's existing Wiki, discussion, community translations, curation and social participation. A useful comment can remain searchable and discussable after leaving the game. That combination may reduce repeated authoring and fragmented conversations, but market absence and exclusive novelty have not been established.

### Users, maintainers and buyers have different jobs

| Segment | Repeated job and benefit | Likely payer / adoption constraint | Priority |
| --- | --- | --- | --- |
| Existing game/Wiki readers | Find the relevant explanation at a location, ask a question and return to the same discussion outside the game. | Most should enter through the ordinary free experience; friction and usefulness matter more than renderer variety. | First |
| Guide authors and translators | Maintain one explanation with spatial applicability and several language contributions instead of copying versions into disconnected tools. | Individual authors may have little budget; editors need visible time savings and credit for their work. | First |
| Existing server or shared-world communities | Keep location-specific knowledge and ongoing discussions attached to the community's maintained world/epoch. | A maintainer or organization is a clearer potential buyer than an occasional commenter. | First |
| Wiki/modpack/community teams | Review, organize and update a body of location-linked content with roles, provenance and continuity across supported updates. | Team workflow, support and maintenance may justify a subscription; ordinary Tag/permission safety should remain baseline. | First paid hypothesis |
| Travel clubs, event organizers and local communities | Organize repeatedly used place knowledge, routes and discussion around an existing group. | An organizer may pay; general nearby-stranger discovery has a much harder density problem. | Later Earth entry |
| External game developers and institutions | Integrate maintained community knowledge and discussion through supported interfaces. | Potential contract revenue, with additional integration/support duties; not the current critical path. | Later |
| Renderer creators | Supply alternative expression and presentation. | Requires both an audience and a sustainable maintenance/terms model; it creates another side of a marketplace too early. | Defer |

The early value cycle should be observable without a new dedicated application: an existing Wiki/guide reader opens a spatial view, finds or contributes useful context, and returns through ordinary REZICS replies, bookmarks or curation. A map impression alone is not a useful-action or retention result.

### Verified worlds can still have low content density

Environment verification answers whether coordinates and applicability are trustworthy. It does not ensure that many people share the same space. If most people use distinct random seeds, even perfectly verified environments can distribute contributions across largely unvisited worlds. Instance-specific player builds fragment content further.

Start with existing maintained servers, commonly used worlds/seeds and a small set of community-owned guide collections. Add approved bindings to already useful material so the first visitor can obtain value before other people leave new comments. Preserve authorship and applicability during this curation; existing prose does not automatically have valid coordinates.

Keep exact-location material distinct from generally applicable game knowledge. An instance warehouse comment belongs to that instance; a general explanation of a mechanic can be offered through a clearly labelled game/topic layer. Broader material should improve the empty-state experience without pretending to be a matching coordinate result. This directly reduces the commercial cost of world fragmentation while preserving logical correctness.

The same distinction matters on Earth. An existing walking club or event already has people, places and reasons to revisit. A universal nearby feed starts with neither local density nor a recurring reason to open the product. The integrated-REZICS strategy reduces account and social fragmentation but does not eliminate the need to create useful spatial content.

### Monetization sequence

1. Establish platform value first: readable map/list discussions, shared replies, curation and multilingual contributions within the ordinary REZICS experience. Measure useful new participation rather than merely moving existing clicks to a map.
2. Evaluate paid maintainer workflows: batch binding/coverage editing, review queues, team workspaces, update assistance, export/backup convenience and supported integrations. The candidate value is saved recurring work, not charging for basic access control or a coordinate marker.
3. Consider managed community/integration services only after maintainers depend on the workflow and service costs are understood. Contract scope and support commitments matter more than adding more presentation modes.
4. Preserve optional commercial renderers for appropriate platforms, with a readable fallback and no purchased exposure. Minecraft-specific monetization remains constrained by its actual terms; an outside-game subscription is not automatically an exception.

These are business hypotheses. ArcGIS and Discourse establish comparable paid offerings; they do not prove that REZICS's particular communities will buy them. No subscription price, conversion rate or revenue forecast is selected here.

### Economic model and durable advantage

For direct subscriptions, a useful first model is `monthly contribution = K * (P - V) - F`, where `K` is paying communities, `P` is net monthly receipts per community, `V` is variable hosting/moderation/support cost, and `F` is fixed integration/editorial maintenance. When `P > V`, the arithmetic break-even community count is `F / (P - V)`. Existing platform retention value should be assessed separately rather than converted into invented revenue.

Versioned adapters, moderation and keeping guides applicable are recurring costs even in verified environments. More supported games can increase those costs faster than contribution until communities create and maintain content themselves. A narrow support catalog can therefore improve both trust and economics.

The durable asset would be a maintained, contextual, multilingual body of content with known contributors and community governance. Coordinates, a renderer API and map presentation alone are comparatively reproducible. Open references and exports can increase creator confidence; the product should earn continued use through content quality and workflow rather than depend on trapping contributions.

Commercial validation can remain lightweight: discuss current repeated tasks with a few existing maintainers, walk through the proposed workflow, identify who owns a budget, and obtain a concrete willingness-to-use or willingness-to-pay statement before building paid features. A later opt-in release can compare meaningful reads, replies, contributions, return use, empty-result frequency and maintainer time spent. No complex technical benchmark is necessary to make that initial business decision.

## 1. Feasibility matrix

"Supported" means there is concrete external implementation/specification evidence and a compatible local integration boundary. "Conditional" means a particular product or operating condition limits the claim. Verified game environments are assumed throughout the selected scope. "Not supported as stated" means the broad promise must change.

| Claim | Assessment | Evidence and practical consequence |
| --- | --- | --- |
| One publication can appear in normal REZICS and on a map | Supported | W3C separates body, target and selector; existing REZICS references and publication ownership provide integration points. Preserve one publication identity. [R01](https://www.w3.org/TR/annotation-model/) |
| Location notes and several clients can share a backend | Supported as an architecture | GeoNotes implemented a shared location-note service; it does not establish present-day engagement or REZICS scale. [R02](https://people.cs.rutgers.edu/~rmartin/teaching/spring03/cs553/readings/espinoza01.pdf) |
| Matching generated worlds can share relevant annotations | Conditional | Restrict matching to an exact generation profile and adequate inputs. Upgraded saves can contain mixed generation and therefore need instance/epoch applicability. [R04](https://feedback.minecraft.net/hc/en-us/articles/4415128577293-Minecraft-Java-Edition-1-18) |
| A Minecraft client can render world markers | Supported for a pinned adapter | Fabric documents world rendering and custom pipelines. Version/driver compatibility and frame cost still need a real client test. [R08](https://docs.fabricmc.net/develop/rendering/world) |
| Radius queries can avoid full-corpus scans | Supported in principle | Spatial indexes and index-aware distance predicates exist. Data distribution, dimension and filtering determine whether the actual plan is selective. [R10](https://www.cs.princeton.edu/courses/archive/fall08/cos597B/papers/rtrees.pdf), [R11](https://postgis.net/docs/ST_DWithin.html) |
| A 2,048-candidate budget reliably fills 50 results under arbitrary permissions and filters | Not supported as stated | At a 1% eligible-candidate rate the expected result is only 20.48 before deduplication. Section 5 gives the calculation. |
| Shared identity and authorization can serve map, Wiki and game clients | Supported as an architecture; local qualification required | Zanzibar demonstrates a cross-service authorization model and the importance of content/ACL ordering. REZICS must use its own qualified authority contract. [R15](https://www.usenix.org/system/files/atc19-pang.pdf) |
| Earth nearby lists can use ordinary devices | Supported with fallback | Browser geolocation supports explicit permission and error outcomes; manual location must remain usable. [R16](https://www.w3.org/TR/geolocation/) |
| A precise AR marker works at every real-world place | Not supported as stated | Pose quality depends on device/location conditions and, in difficult settings, VPS coverage. AR requires a separate availability/accuracy gate. [R17](https://developers.google.com/ar/develop/java/geospatial/check-vps-availability) |
| Minecraft rendering can be sold through an external REZICS entitlement | Not an eligible default | Current mod commercialization and external-entitlement rules constrain that flow. Keep initial Minecraft rendering free. [R20](https://www.minecraft.net/en-us/eula), [R21](https://www.minecraft.net/en-us/usage-guidelines) |
| Integration into REZICS ensures activity or a viable business | Unproven product hypothesis | Architecture reuse reduces fragmentation, but no cited study tests REZICS retention, world fragmentation or willingness to pay. Require a focused opt-in pilot. |

## 2. Content, social context and the existing repository

The W3C Web Annotation model separates the annotation body from its target and any selector/state identifying the relevant part or representation. This supports attaching an existing publication to a spatial target. It is not a spatial coordinate protocol, an authorization system or evidence that a custom spatial selector is automatically conformant. [R01](https://www.w3.org/TR/annotation-model/)

GeoNotes describes an implemented location-note service with a shared server, a client capable of posting/retrieving notes and a simulated-position path. It also discusses sorting and social/content filtering to manage information overload. Several proposed filters were still unimplemented in that paper. This is evidence that the basic interaction and service decomposition can be built, not a large-scale field evaluation or proof of a successful modern product. [R02, sections 3-4](https://people.cs.rutgers.edu/~rmartin/teaching/spring03/cs553/readings/espinoza01.pdf)

The repository already contains an explicit [Resource reference contract](../../libraries/reference/src/index.ts), a [concrete-FK reference bridge](../../libraries/schema/src/postgres/knowledge/reference-value.ts), [owner-dispatched state reads](../../services/main/src/services/units/query.ts), and [Post/reply storage](../../libraries/schema/src/postgres/forum/post.ts). These establish ways to identify, resolve and discuss resources without a shared Resource parent row. The [Block registry](../../libraries/block/src/blocks.ts) and [Filter vocabulary](../../libraries/filter/src/unit.ts) still require a spatial extension; none of those files proves a spatial runtime exists.

The resulting integration recommendation is specific: own geometry and world interpretation in a spatial domain; attach exact published content through a typed binding; reuse existing Tag/favorite/report/Realm operations through qualified references. A Zone map should query those bindings while applying its normal source narrowing. A Collection remains stored curation. The proposed feature does not require the optional Dynamic Collection product or a universal untyped Context table.

The platform's virtual REZICS Work can organize guides and community translations, but it is not a generated game world or an instance identifier. Preserving that distinction allows one maintained guide Work to discuss several worlds, and one space to have several community guides, without merging content ownership or social governance.

## 3. Logical world identity within verified environments

### 3.1 What can be identified reliably

A generation contract must distinguish at least three things: the inputs that a generator consumes, the observed world state, and the audience/controller of a save. Matching one does not prove the other two. A practical shared space can be defined around a supported generation profile, with exact generator inputs and explicit scope; arbitrary modifications and save history remain outside that equality claim.

Minecraft's official 1.18 release notes describe blending new and old terrain and adding new generation beneath existing chunks. An upgraded save can therefore preserve old terrain while containing new generated regions. The consequence for this design is that game version and one current recipe are not a complete description of every region's origin; recipe comments need applicability and instance/epoch handling. [R04, "Upgrading of old worlds"](https://feedback.minecraft.net/hc/en-us/articles/4415128577293-Minecraft-Java-Edition-1-18)

Modrinth's format records dependencies, file hashes and configuration overrides. That is useful acquisition evidence, but its manifest does not prove that a file is irrelevant to generation, that generation is deterministic under every installed mod, or that two existing saves have identical state. [R05](https://support.modrinth.com/en/articles/8802351-modrinth-modpack-format-mrpack)

Verification is accepted as a premise. The following distinctions remain necessary even after an environment is verified; they are identity and governance meanings, not a new environment-testing program.

| Logical value | Meaning | Consequence |
| --- | --- | --- |
| Generation recipe/profile | The supported inputs and interpretation for generated features. | Qualified presentation-only observations can share this identity. |
| Instance | A particular maintained save/server. | Player-created changes and private discussions remain associated with that instance. |
| Epoch/applicability | The relevant reset, upgrade or regional generation state. | Old comments retain their original context rather than silently becoming current facts. |
| Social audience/controller | Who may maintain or access the relevant resource. | Matching coordinates or generation inputs does not transfer governance or read permission. |

Keep the canonical generation recipe separate from a broader installation observation. If adding a shader or changing UI configuration produces a new installation observation, it can still refer to the same generation recipe when the qualified profile classifies that change as presentation-only. Otherwise, keying the shared namespace by every full-manifest revision would fragment the very worlds the design intends to share.

### 3.2 Scope of the verified integration

Minecraft and other supported games are assumed to have verified integration environments. Establishing arbitrary-server compatibility is not a research deliverable, and the separately developed fully supported game is excluded. The logical requirement is to retain the integration profile, recipe/instance identity, coordinate interpretation and version applicability supplied by those environments.

Fabric's networking documentation distinguishes logical client and server, including the integrated server used in singleplayer. That distinction explains why an adapter contract must identify the origin of its context; it does not create a requirement to investigate every unsupported deployment. [R06](https://docs.fabricmc.net/develop/networking)

The selected support catalog should state which environment provides each field and which changes create a new epoch. If an environment falls outside its declared profile, treat it as unsupported until admitted. This keeps the data model coherent without expanding the current feature into universal environment discovery.

## 4. Spatial storage, distance and index choice

R-trees are established dynamic spatial indexes with searching and update algorithms. Guttman's original paper also explicitly notes that overlap can require searching several subtrees and prevents a good general worst-case guarantee. Its historical experiments are not evidence for contemporary REZICS latency at billions of rows. [R10, section 3.1](https://www.cs.princeton.edu/courses/archive/fall08/cos597B/papers/rtrees.pdf)

PostGIS provides an index-aware `ST_DWithin`; geometry distance uses the coordinate system's units, while geography distance is expressed in meters. This supports a practical Earth radius-query option, provided the selected SRID, predicate and index actually match. [R11](https://postgis.net/docs/ST_DWithin.html)

Minecraft caves and buildings require an explicit definition of "nearby." `ST_3DDWithin` evaluates three-dimensional distance, and the PostGIS workshop distinguishes N-D indexing from the default 2-D index. Storing a Z coordinate alone does not make a 2-D query or index height-sensitive. [R12](https://postgis.net/docs/ST_3DDWithin.html), [R13](https://postgis.net/workshops/postgis-intro/3d.html)

Select the distance contract before the index: horizontal map distance with a vertical band, Euclidean 3-D distance, or geodesic Earth distance with a separately declared altitude policy. Carry that choice in the query/cursor. Compare a game-cell B-tree candidate plan with an appropriate spatial-index plan; do not prescribe one engine for all workloads without evidence.

H3's region API distinguishes center containment from full containment and overlap modes, including an experimental overlap API. A center-only polygon cover can omit a cell that intersects the query boundary and contains a matching point. Candidate generation must cover all possible matches before exact filtering; pin any experimental API version or use another demonstrated conservative covering method. [R14](https://h3geo.org/docs/api/regions/)

Canonical structures remain sparse: store authored anchors and bindings, not the entire coordinate lattice. A projection can index one shared recipe-space comment once and query it from multiple matching instances. That is the scaling benefit of the proposed data ownership; it is not achieved by copying the comment into every player's save.

## 5. Basic workload reasoning

Complex performance testing is outside this assessment. The relevant logical constraints are sparse storage, bounded candidate discovery, meaningful continuation and separate canonical/projection ownership. Existing spatial indexing evidence is enough to support those mechanisms; no particular p95 or corpus-size claim follows from it.

One simple sensitivity check is useful: with 2,048 candidates and a 1% rate of surviving residual filters, the expected surviving count is `2,048 * 0.01 = 20.48`, before deduplication. The proposed 50-result page therefore cannot be an unconditional completeness promise. Supported queries need selective source predicates and explicit partial results; they must not scan indefinitely to fill a page.

Likewise, a fixed cell count has meaning only with a declared cell size, dimension and admitted radius. Horizontal maps and three-dimensional cave proximity can share stored points while using different query semantics. These are logical contract choices, not a reason to launch a benchmark program now.

The feature plan retains the repository's 500,000,000-row baseline and 3,000,000,000-row estimate as planning arithmetic. Future implementation can perform checks appropriate to its actual workload; this research neither requires a complex load test nor reports one as completed.

## 6. Shared permissions and cache behavior

Zanzibar is evidence that one authorization model can serve many content services. Its content/ACL ordering discussion identifies the failure where a revoked user sees newer content because a stale permission decision is applied. This is directly relevant to maps and overlays consuming cached candidate sets, but it is not a reason to copy Zanzibar's deployment or performance figures into REZICS. [R15, sections 1-2.2](https://www.usenix.org/system/files/atc19-pang.pdf)

A spatial candidate is therefore only a discovery hint. Before disclosing geometry, content, snippets or clusters, the server must apply current access to the binding, exact content selection, space and social source. Public basemap tiles and protected REZICS overlay data need separate cache policies. Aggregate counts require an audience-safe generation or an explicitly unavailable result; filtering marker bodies after emitting a global count is insufficient.

Prefer on-demand authorized overlay responses for the initial release. Deferring public server-generated comment tiles and exact cluster counts reduces a concrete privacy/invalidation dependency. If later enabled, those products need their own security domain and invalidation qualification.

Revocation can stop new server disclosures and instruct cooperative clients to evict cached content. It cannot retract bytes already delivered, screenshots or copies retained by an independent client. Describe erasure guarantees in those terms; never claim that a restore/erasure test proves remote copies are erased.

The repository's single-database authority fences and reference dispatch are the relevant starting implementation. Spatial integration must exercise races against that implementation. The logical owner split remains compatible with this approach; implementing cross-database authorization coordination is outside the next-version initial release.

## 7. Rendering, Earth and commercial constraints

### 7.1 Rendering and adapters

Fabric's world-rendering guide demonstrates custom render pipelines and separates preparation/extraction from drawing. Its current rendering concepts also document changes including an optional Vulkan backend in the 26.2 documentation set. These are concrete extension points and a concrete reason to pin renderer compatibility rather than depend on generic raw graphics hooks. [R08](https://docs.fabricmc.net/develop/rendering/world), [R09](https://docs.fabricmc.net/develop/rendering/basic-concepts)

Mumble Link separates context, avatar pose and camera pose, and requires an integration to supply those values. It supports the adapter architecture; it does not discover context for every unsupported game. [R03](https://www.mumble.info/documentation/developer/positional-audio/link-plugin/)

A renderer preference can consequently remain declarative, with built-in text/icon/list fallbacks. Package signature, sandboxing, resource budgets and entitlement are different concerns. There is no evidence here that arbitrary third-party renderer code is safe to execute inside a trusted game process; that remains a separate later capability.

### 7.2 Earth experience

The Geolocation specification defines permission, secure-context and unavailable/timeout outcomes. A location-based list can use this API, with manual location selection covering denied or missing positioning. `geo:` identifies WGS-84 coordinates and distinguishes absent uncertainty from zero; neither interface proves a user is entitled to access a place's private discussion. [R16](https://www.w3.org/TR/geolocation/), [R22](https://www.rfc-editor.org/rfc/rfc5870.html)

ARCore's documentation makes availability conditional on location/pose conditions; VPS matters where GPS is poor, while suitable outdoor conditions may work without it. A map/list release therefore does not need to wait for AR, and AR quality should be gated by measured pose accuracy and availability rather than a location API succeeding. [R17](https://developers.google.com/ar/develop/java/geospatial/check-vps-availability)

The mobility study by de Montjoye and colleagues examined 1.5 million individuals over fifteen months and found that four spatiotemporal observations uniquely identified 95% in that dataset. It supports minimizing linked movement traces; it is not a quantitative prediction for REZICS users or isolated chosen-location posts. [R18](https://www.nature.com/articles/srep01376)

Publish the chosen subject location, not automatic device whereabouts. Keep per-frame camera data client-local and omit background movement-history collection from the initial feature. Coarsening coordinates is not a complete anonymity guarantee.

OpenStreetMap's public raster tile service prohibits bulk/offline tile acquisition and imposes service-use requirements. Open map data does not imply unrestricted hosted map infrastructure. Choose a permitted provider or self-hosted strategy before promising offline maps or high-volume clients; REZICS annotations remain separately owned and authorized data. [R19](https://operations.osmfoundation.org/policies/tiles/)

### 7.3 Paid modes

Minecraft's EULA constrains selling/monetizing mods, and its Usage Guidelines restrict using mods to verify access to external goods/services affecting in-game features. The proposed external-entitlement unlock cannot be treated as an approved default. Initial Minecraft renderers should be free. Any later commercial integration must assess the actual platform-specific flow against then-current rules, rather than assume external billing resolves it. [R20](https://www.minecraft.net/en-us/eula), [R21](https://www.minecraft.net/en-us/usage-guidelines)

Other supported platforms may have different terms. Preserve commercial rendering as a separately elected option while keeping content readable and preventing entitlement from bypassing audience, moderation or display budgets. Business viability and willingness to pay remain untested.

## 8. Required plan changes

| Finding | Change to the next-version plan | Decision basis |
| --- | --- | --- |
| Verified environments are the selected boundary | Assume qualified Minecraft and other admitted game profiles; exclude automatic support for unknown environments. Remove the separately developed game as a dependency. | Confirmed scope; retain identity/version contracts without repeating environment discovery. |
| Full installation revisions can fragment shared worlds | Canonical generation recipes exclude qualified presentation-only observations; installation history remains separate. | The logical identity must match the intended sharing unit. |
| Frames do not define the meaning of nearby | Specify distance metric and optional vertical band in the query/cursor contract. | A map distance and a cave/floor distance answer different questions. |
| Content and community views can share one identity | Use existing publications, exact bindings, Resource capabilities and social layers. | Annotation model, local ownership contracts and existing commercial map/list discussion products. |
| Shared display data can leak private context | Start with authorized overlay responses; separate public basemaps from protected annotations and counts. | Current access must apply to geometry as well as content; already delivered bytes cannot be retracted. |
| Verification does not create local activity | Start in existing shared-world communities and curate useful existing guides into applicable spatial views. | Unique seeds and private instances can fragment the content supply even when technically valid. |
| Paying maintainers have clearer repeated work than casual commenters | Evaluate editorial collaboration, maintenance and management subscriptions before a renderer marketplace. | Comparable paid organization/community offerings exist; REZICS demand remains a hypothesis. |
| Technical tests are not the current decision | Prioritize scenario reasoning, primary-source comparison and commercial analysis. Keep ordinary implementation verification separate. | No complex performance testing or self-developed-game integration is required here. |

These changes belong only to the next-version proposal. This assessment owns evidence and business rationale; the feature plan owns the resulting scope and sequence. The primary implementation plan remains unchanged.

## 9. Decision checks and commercial unknowns

Logical review should walk through a few concrete scenarios: one publication in several clients; the same point in different instances; a world reset; a community translation; a private binding shown through a public Zone; and removing a map appearance while retaining the original post. The selected ownership and binding rules provide a coherent outcome for each. None requires a second forum identity or changing the meaning of a REZICS Work.

The commercially important unknowns are the size and activity of existing eligible communities, whether readers repeatedly need location-specific information, who will curate initial anchors, how much maintainer effort the integrated workflow saves, and whether someone with a budget values those savings. Public product offerings cannot answer these REZICS-specific questions.

A lightweight follow-up can use maintainer conversations and a walkthrough of the proposed workflow. Ask which task is repeatedly painful, how it is done today, who maintains the knowledge, what would make the team switch, and which specific continuing service they would pay for. Do not interpret general enthusiasm for a map as a purchase commitment.

At release, assess meaningful reads/replies/contributions and repeat use across normal and spatial views, together with empty-result, mismatch, hide/report and maintenance effort. If the feature only redistributes existing clicks or creates mostly empty worlds, revise content supply and entry points before expanding supported games. If teams save ongoing work and a budget owner commits to a specific service, the subscription hypothesis becomes stronger.

The decision supported now is to retain spatial discussion as a next-version REZICS capability for verified environments, pursue an existing-community entry, and defer standalone network expansion, AR-first delivery, paid Minecraft renderer unlocks and the separately developed game's full integration. Revenue potential is plausible but unquantified; no market-size, adoption or profitability claim is established.

## Sources

Primary sources and versioned project interfaces checked on 2026-09-12. Historical papers establish mechanisms or bounded observations, not current performance forecasts. Live documentation must be pinned/rechecked when an adapter or commercial integration is activated.

| ID | Source | Date/version and evidence scope |
| --- | --- | --- |
| R01 | W3C, [Web Annotation Data Model](https://www.w3.org/TR/annotation-model/) | Recommendation, 2017; annotation/body/target/selector/state model. |
| R02 | Fredrik Espinoza, Per Persson, Anna Sandin, Hanna Nystrom, Elenor Cacciatore and Markus Bylund, [GeoNotes: Social and Navigational Aspects of Location-Based Information Systems](https://people.cs.rutgers.edu/~rmartin/teaching/spring03/cs553/readings/espinoza01.pdf) | UbiComp 2001, pp. 2-17; original paper mirrored by Rutgers. [Institutional record](https://ri.diva-portal.org/smash/record.jsf?pid=diva2%3A1041644). |
| R03 | Mumble, [Integrate Positional Audio Through the Link Plugin](https://www.mumble.info/documentation/developer/positional-audio/link-plugin/) | Project documentation; supplied context and pose interface. |
| R04 | Mojang, [Minecraft: Java Edition - 1.18](https://feedback.minecraft.net/hc/en-us/articles/4415128577293-Minecraft-Java-Edition-1-18) | 2021 release notes; concrete mixed-generation upgrade behavior. |
| R05 | Modrinth, [Modpack Format (.mrpack)](https://support.modrinth.com/en/articles/8802351-modrinth-modpack-format-mrpack) | Project format documentation; acquisition manifest, not a world-equivalence proof. |
| R06 | Fabric, [Networking](https://docs.fabricmc.net/develop/networking) | Documentation set presented as 26.2; logical/physical client-server boundaries. |
| R08 | Fabric, [Rendering in the World](https://docs.fabricmc.net/develop/rendering/world) | Documentation set presented as 26.2; custom world render pipeline. |
| R09 | Fabric, [Basic Rendering Concepts](https://docs.fabricmc.net/develop/rendering/basic-concepts) | Documentation set presented as 26.2; changing backend/API constraints. |
| R10 | Antonin Guttman, [R-Trees: A Dynamic Index Structure for Spatial Searching](https://www.cs.princeton.edu/courses/archive/fall08/cos597B/papers/rtrees.pdf) | SIGMOD 1984, pp. 47-57; original paper mirrored by Princeton. [Publication DOI](https://doi.org/10.1145/602259.602266). |
| R11 | PostGIS, [ST_DWithin](https://postgis.net/docs/ST_DWithin.html) | Project documentation; distance units and index-aware filtering. |
| R12 | PostGIS, [ST_3DDWithin](https://postgis.net/docs/ST_3DDWithin.html) | Project documentation; three-dimensional predicate. |
| R13 | Paul Ramsey, Mark Leslie and PostGIS contributors, [3-D workshop](https://postgis.net/workshops/postgis-intro/3d.html) | Project material; N-D versus 2-D indexes. |
| R14 | H3, [Region functions](https://h3geo.org/docs/api/regions/) | Current API documentation; containment/overlap distinctions and experimental API status. |
| R15 | Ruoming Pang et al., [Zanzibar: Google's Consistent, Global Authorization System](https://www.usenix.org/system/files/atc19-pang.pdf) | USENIX ATC 2019, pp. 33-46; service integration and content/ACL consistency. |
| R16 | W3C, [Geolocation](https://www.w3.org/TR/geolocation/) | Current specification; permission, secure-context and error semantics. |
| R17 | Google, [Check VPS availability at the device's current location](https://developers.google.com/ar/develop/java/geospatial/check-vps-availability) | Current ARCore documentation; location/coverage-dependent pose capability. |
| R18 | Yves-Alexandre de Montjoye, Cesar A. Hidalgo, Michel Verleysen and Vincent D. Blondel, [Unique in the Crowd: The privacy bounds of human mobility](https://www.nature.com/articles/srep01376) | Scientific Reports 3, 1376, 25 March 2013; observational mobility dataset, DOI 10.1038/srep01376. |
| R19 | OpenStreetMap Foundation, [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) | Current hosted raster tile policy; distinct from open-data availability. |
| R20 | Mojang/Microsoft, [Minecraft EULA](https://www.minecraft.net/en-us/eula) | Current terms; commercialization constraints. |
| R21 | Mojang/Microsoft, [Minecraft Usage Guidelines](https://www.minecraft.net/en-us/usage-guidelines) | Current terms; external-entitlement restrictions affecting mods. |
| R22 | Alexander Mayrhofer and Christian Spanring, [RFC 5870: A Uniform Resource Identifier for Geographic Locations](https://www.rfc-editor.org/rfc/rfc5870.html) | June 2010; WGS-84 coordinates and uncertainty. |
| R23 | Esri, [Use discussion boards](https://doc.esri.com/en/arcgis-hub/latest/collaborate/use-discussion-boards.html) | Current ArcGIS Hub documentation; map/grid/list presentations and participation channels. |
| R24 | Esri, [ArcGIS Hub purchase options](https://www.esri.com/en-us/arcgis/products/arcgis-hub/purchase-options) | Current commercial offering; additional annual Premium subscription, not disclosed customer revenue. |
| R25 | Civilized Discourse Construction Kit, [Discourse pricing](https://www.discourse.org/pricing) | Live USD plans checked 2026-09-12; Pro 100/month and Business 500/month, plus free offering. |
| R26 | Map Genie, [Genshin Impact Map developer listing](https://play.google.com/store/apps/details?id=io.mapgenie.genshinmap) | Current developer description and in-app-purchase label; user-review prices/revenue claims excluded. |

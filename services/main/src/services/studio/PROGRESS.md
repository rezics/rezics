# Studio Progress

Planning context:

- [Outline: Studio tool](https://outline.rezics.com/doc/studio-1IyFIkqV8c)

```progress
id: studio.creator-insights
status: open
goal: Give creators trustworthy, privacy-bounded evidence about how their published work is discovered and opened.
depends:
  - studio.content-workspace
  - observability.runtime-signals
accept:
  - Impression, eligible view, click-through, unique audience, time window, content identity, locale, referrer class, and aggregation have explicit definitions.
  - Studio reports explain sampling, bot filtering, delayed data, retention, privacy thresholds, unavailable data, and corrections instead of implying false precision.
  - Collection is consent- and policy-aware, excludes sensitive identifiers from creator output, and cannot be used to infer a protected individual.
verify:
  - Run event-contract, attribution, deduplication, bot-filter, aggregation, authorization, privacy-threshold, retention, correction, and report tests.
  - Reconcile a controlled impression-and-click dataset with the creator report across locale, referrer, delayed-event, low-volume, and deleted-content cases.
```

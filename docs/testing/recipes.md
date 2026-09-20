# Recipe acceptance

Owner: M02-M04/M07/M09 with native content consumers. Contract:
[native recipes](../architecture/database/recipes.md). These are required
first-stage scenarios, not executed evidence. Author executable tests and run
them at the [applicable phase](../plan/execution-workflow.md).

| ID | Required behavior |
| --- | --- |
| RECIPE01 | Create/edit/read a recipe without a provider or fabricated Work/release; capability admission preserves Resource owner and ID. |
| RECIPE02 | Preserve multiple same-language names, attribution, content language and original source spelling. |
| RECIPE03 | Use the same ingredient twice with different groups, quantities and order; reorder/remove one occurrence without changing the other or the ingredient. |
| RECIPE04 | Preserve exact fractions/ranges, unknown units, missing amounts and qualitative text; reject unsupported conversions rather than inventing quantities. |
| RECIPE05 | Reorder grouped steps with media, retaining occurrence identity and current disclosure; stale or unauthorized edits fail. |
| RECIPE06 | Publish/share/edit a recipe through native content, keeping drafts private and following the eligible published head; explicit fixed citations remain exact. |
| RECIPE07 | Dynamically acquire an elected Recipe JSON-LD example, import/query/export with an explicit loss report; residual fields do not disappear and raw-only retention does not qualify native coverage. |
| RECIPE08 | Repeat import, interleave human edits and source correction/withdrawal, then replay; no duplicate occurrences, overwritten human ownership or unauthorized restoration. |
| RECIPE09 | Query names/author/ingredient and elected duration/yield values using bounded pages with missing/unknown distinctions and current disclosure. |
| RECIPE10 | Restore content/metadata and rebuild projections under erasure/revocation rules; measure occurrence/history/index amplification and representative skew at the 500M/3B planning scales. |

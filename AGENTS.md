STUDY DEEPLY BEFORE ANYTHING, PROACTIVELY RESEARCH ONLINE TO ENSURE BEST PRACTICES.

# AI Agent Instructions

- Read [CONTRIBUTING.md](./CONTRIBUTING.md) before making changes.
- Put all agent-generated temporary artifacts under `.temp/`, including design-QA screenshots, comparisons, reports, and any notes or checklists used to keep implementation aligned with an agreed plan. Remove artifacts created for the current task before finishing unless the user explicitly asks to retain them; never delete pre-existing or user-provided files.
- This is still in the development phase, so unless specifically requested, any changes should not include any compatibility measures for legacy code.

## Project stack

- The main frontend uses React, Vinext, and Tailwind CSS; consume shared UI through `@rezics/ui`.
- SharkUI is the canonical UI system. Do not introduce or substitute another UI library.
- Treat `libraries/ui/src/ui` as the upstream SharkUI mirror; put project-owned shared components in `libraries/ui/src/custom`.

## Frontend architecture

- Treat `apps/web/app` as a framework adapter layer, not an implementation layer. Keep only App Router special files and narrowly scoped adapters that must run at the routing or request boundary there. A route entry may read and validate framework inputs such as `params`, `searchParams`, headers, and cookies; declare metadata or route configuration; invoke framework control flow such as `redirect` or `notFound`; compose required root providers and boundaries; and then delegate immediately to project-owned code.
- Put page and screen composition, application-shell UI, feature behavior, data access, client state and effects, and reusable components under the owning `apps/web/features/<capability>` module, or under an existing non-`app` infrastructure owner such as `lib` or `i18n`. App Router entries should import, re-export, or pass request-derived values into those owners; do not add ordinary implementation modules under `apps/web/app`.

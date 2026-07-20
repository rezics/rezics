STUDY DEEPLY BEFORE ANYTHING, PROACTIVELY RESEARCH ONLINE TO ENSURE BEST PRACTICES.

# AI Agent Instructions

- Read [CONTRIBUTING.md](./CONTRIBUTING.md) before making changes.
- Put all agent-generated temporary artifacts under `.temp/`, including design-QA screenshots, comparisons, reports, and any notes or checklists used to keep implementation aligned with an agreed plan. Remove artifacts created for the current task before finishing unless the user explicitly asks to retain them; never delete pre-existing or user-provided files.
- This is still in the development phase, so unless specifically requested, any changes should not include any compatibility measures for legacy code.

## Project stack

- The main frontend uses React, Vinext, and Tailwind CSS; consume shared UI through `@rezics/ui`.
- SharkUI is the canonical UI system. Do not introduce or substitute another UI library.
- Treat `libraries/ui/src/ui` as the upstream SharkUI mirror; put project-owned shared components in `libraries/ui/src/custom`.

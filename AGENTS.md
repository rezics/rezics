--- STUDY DEEPLY BEFORE ANYTHING ---

# AI Agent Instructions

- Read [CONTRIBUTING.md](./CONTRIBUTING.md) before making changes.
- Put all agent-generated temporary artifacts, including design-QA screenshots, comparisons, and reports, under `.temp/`. Never put them in the repository root or product source directories.
- This is still in the development phase, so unless specifically requested, any changes should not include any compatibility measures for legacy code.

## Project stack

- The main frontend uses React, Vinext, and Tailwind CSS; consume shared UI through `@rezics/ui`.
- SharkUI is the canonical UI system. Do not introduce or substitute another UI library.
- Treat `libraries/ui/src/ui` as the upstream SharkUI mirror; put project-owned shared components in `libraries/ui/src/custom`.

# Spec: Metadata Page Redesign

## Overview
Replace MUI components with shadcn on the book metadata editing page for improved visual design.

## Requirements
- shadcn Input + Label (above, not floating) for text fields
- shadcn Card for section grouping: Basic Info, Contributors, Description, Extra
- shadcn Checkbox + Tooltip for flags (Licensed, NSFW)
- shadcn Button for actions
- Extra section (Publish URLs + JSON) collapsible, closed by default
- `max-w-3xl mx-auto` centering
- 2-column grid on desktop, single column on mobile
- Keep MUI Autocomplete for UsersMultiSelect (complex async multi-select)
- Keep RezicsMarkdownEditor for description

# Spec: Chapter Tree Editor

## Overview
Dedicated chapter tree editor component for the book-edit feature, independent from the reader tree.

## Requirements
- Centered layout with `max-w-2xl`, full available height
- Always-on drag-and-drop with visible drag handles
- Mock word count per node (seeded random based on node id)
- Parent nodes sum children word counts
- Inline rename on double-click (always enabled)
- Radix ContextMenu with animations (rename, new child, new sibling, move first/last, delete)
- One-click chapter creation: append to last non-leaf node, auto-enter rename
- Toolbar: search, expand/collapse all, new chapter button
- Footer: chapter count, total word count, download JSON, save button
- JSON editor retained as secondary tab
- Mobile responsive (full-width on small screens)

# @rezics/preview

Read-only preview rendering service for the Rezics platform. Generates HTML and SVG previews for bots, crawlers, and social media link unfurlers.

## Overview

A lightweight Elysia-based service that handles non-human user requests routed by Nginx. It queries the database in read-only mode to render book previews for SEO and social sharing without exposing write operations.

## Purpose

- **SEO** — Server-rendered HTML for search engine crawlers
- **Social Sharing** — Open Graph and meta tag generation for link previews
- **Bot Routing** — Nginx forwards non-human user agents to this service

## Design Constraints

- **Read-only** — Only performs database queries, never writes
- **Public-facing** — No authentication required for preview endpoints
- **Lightweight** — Minimal dependencies, fast response times

## Scripts

```bash
task preview:dev    # Start with --watch (development)
```

## Tech Stack

- [Elysia](https://elysiajs.com) HTTP framework
- [React 19](https://react.dev) for server-side rendering
- Database access via `@rezics/server` (read-only)
- Types from `@rezics/contract`

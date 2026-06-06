# Development Notes

## Nginx Routing

Non-human user agents (bots, crawlers) should be routed to the preview service via Nginx.

## Design Constraints

- Preview must only perform database reads, never writes.
- Used for rendering previews for bots and for SVG/HTML-based API responses.

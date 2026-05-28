import type { NotificationItem, NotificationTarget } from "@rezics/contract";

/**
 * Resolve a notification's deep-link href from the server-provided `target`.
 *
 * The server emitter picks `target.route` per the link-selection policy in
 * `app-product-navigation` (keyed on the event's `kindKey` — e.g. reply →
 * thread + anchor, follow → profile, moderation outcome → detail, TOC/node
 * event → node route) and supplies the concrete `params` (including slugs the
 * client cannot derive). This helper substitutes `:param` placeholders in the
 * route template and appends the optional anchor.
 *
 * Returns `null` when the notification carries no target, so the card renders
 * as a non-navigating item (it still marks itself read on click).
 */
export function resolveNotificationHref(item: NotificationItem): string | null {
  if (!item.target) return null;
  return targetToHref(item.target);
}

export function targetToHref(target: NotificationTarget): string {
  const path = target.route.replace(/:([A-Za-z0-9_]+)/g, (whole, key) => {
    const value = target.params[key];
    return value === undefined ? whole : encodeURIComponent(value);
  });
  return target.anchor ? `${path}#${target.anchor}` : path;
}

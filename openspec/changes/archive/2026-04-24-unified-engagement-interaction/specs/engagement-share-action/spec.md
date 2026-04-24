## ADDED Requirements

### Requirement: ShareAction renders a share popover

The `ShareAction` atom (rendered by `ReactionBar` when the `"share"` token is present) SHALL render an icon (↗) plus the label "Share" (localised). Clicking the button SHALL open a popover anchored to the button that contains:

1. A "Copy link" entry that writes the content's canonical detail URL to the clipboard and shows a short-lived success toast.
2. Where the browser supports the Web Share API (`navigator.share`), a "Share…" entry that invokes `navigator.share({ url, title })` with the content's URL and a reasonable title (post body preview, review title, remark first line, etc.).

When the Web Share API is unavailable, the "Share…" entry SHALL NOT render; only the copy-link entry appears.

#### Scenario: Copy link writes to clipboard
- **WHEN** a user clicks ShareAction and selects "Copy link"
- **THEN** the clipboard receives the content's canonical URL
- **AND** a toast / snackbar confirms the copy

#### Scenario: Web Share API invoked on supported browsers
- **WHEN** a user on a supported browser clicks "Share…"
- **THEN** `navigator.share` is called with `{ url, title }`

#### Scenario: Web Share API absent on desktop browsers without support
- **WHEN** `navigator.share` is undefined
- **THEN** the popover renders only the "Copy link" entry
- **AND** no error or broken menu item is visible

### Requirement: Share URL is sourced from content policy

Each content feature's policy helper (see `engagement-reaction-bar`) SHALL provide `getShareHref(post)` that returns the canonical share URL for that post. `ShareAction` SHALL call this function to obtain the URL. For a reply inside a thread, `getShareHref` SHALL return the reply's own detail route (e.g. `/post/:replyUnitId`) rather than the thread root. For a review card, `getShareHref` returns `/review/:reviewId`. For a remark, `/remark/:remarkId`. Etc.

#### Scenario: Sharing a reply uses the reply's own route
- **WHEN** a user opens the share popover on a non-root reply inside a thread
- **THEN** the URL copied to clipboard points to that reply's detail page, not the thread's root

#### Scenario: Sharing a review card uses /review/:id
- **WHEN** a user opens the share popover on a `ReviewCard`
- **THEN** the URL copied is the canonical review detail URL

### Requirement: ShareAction lives under engagement

`ShareAction` and its popover SHALL be exported from `package/app/src/engagement/`. Content features SHALL NOT define feature-local share buttons.

#### Scenario: No duplicate share UI exists
- **WHEN** a developer searches for share popovers / dialogs inside content feature folders
- **THEN** no file under `review/`, `remark/`, `excerpt/`, `post/`, or `shelf/` defines a share button distinct from `engagement/ShareAction`

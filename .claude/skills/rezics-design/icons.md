# Icon Vocabulary — Canonical Mapping

This file is the canonical reference for the rezics icon system. Read this **before** picking an icon.

## Top-Level Rules

1. **`lucide-react` is the default icon source.** Reach for it first.
2. **`@tabler/icons-react` is the named fallback** when `lucide-react` lacks a glyph. Add the package to `@rezics/ui` `dependencies` only on first use; do not preempt.
3. **No third icon library.** Brand marks (vendor logos, custom affordances) that neither library carries become inline `<svg>` primitives owned by rezics.
4. **No emoji in UI chrome.** Emoji are content (user posts, comments). Affordances — close, menu, expand, star, check, arrows — are icons.
5. **Named imports only:** `import { Star } from "lucide-react"`. Never barrel imports.
6. **Sizing via UnoCSS classes:** `w-4 h-4` (body), `w-5 h-5` (UI affordances), `w-6 h-6` (emphasized buttons). Avoid the numeric `size={…}` prop.
7. **Color via `currentColor`.** Override with `text-*` UnoCSS classes pointing to `--rezics-color-*` tokens — never hex.

## Replacement Convention

- Most MUI icons map 1:1 to `lucide-react` by simple rename (e.g. `Edit` → `Edit`, `Search` → `Search`).
- MUI's `*Outlined` / `*Rounded` / `*Sharp` variants collapse: `lucide-react` exposes one stroke style. The MUI variant suffix is dropped (e.g. `EditOutlined` → `Edit`, `PushPinRounded` → `Pin`).
- For filled vs outlined affordances (e.g. favorite filled vs unfilled), use the same `lucide-react` glyph and toggle the visual via `fill="currentColor"` and `text-*` color, not by swapping icon names.
- For the few MUI icons without a `lucide-react` counterpart, use `@tabler/icons-react`. If neither exists, author an inline `<svg>` primitive in `package/ui/src/primitive/icon/`.

## Mapping Table

### General actions

| MUI name | Replacement library | Replacement export | Notes |
| --- | --- | --- | --- |
| `Add`, `AddRounded` | `lucide-react` | `Plus` | |
| `ArrowBack` | `lucide-react` | `ArrowLeft` | |
| `ArrowDownward` | `lucide-react` | `ArrowDown` | |
| `ArrowUpward` | `lucide-react` | `ArrowUp` | |
| `ArrowDropDown` | `lucide-react` | `ChevronDown` | MUI's "drop down" arrow is visually a chevron |
| `ArrowForwardIosRounded` | `lucide-react` | `ChevronRight` | |
| `Cancel` | `lucide-react` | `XCircle` | Filled X-in-circle for hard cancel |
| `Check` | `lucide-react` | `Check` | |
| `CheckCircle`, `CheckCircleOutline` | `lucide-react` | `CircleCheck` | Stroke style only — colorize via class |
| `ChevronLeft` | `lucide-react` | `ChevronLeft` | |
| `ChevronRight` | `lucide-react` | `ChevronRight` | |
| `Close` | `lucide-react` | `X` | |
| `ContentCopy` | `lucide-react` | `Copy` | |
| `Delete`, `DeleteOutline`, `DeleteOutlineRounded` | `lucide-react` | `Trash2` | Trash2 has a lid+handle that reads as "delete" |
| `Done` | `lucide-react` | `Check` | |
| `Edit`, `EditOutlined`, `EditRounded` | `lucide-react` | `Pencil` | "Pen" reads as compose; `Pencil` reads as edit |
| `ExpandLess` | `lucide-react` | `ChevronUp` | |
| `ExpandMore` | `lucide-react` | `ChevronDown` | |
| `KeyboardArrowDown` | `lucide-react` | `ChevronDown` | |
| `KeyboardArrowLeft` | `lucide-react` | `ChevronLeft` | |
| `KeyboardArrowRight` | `lucide-react` | `ChevronRight` | |
| `Launch`, `OpenInNew` | `lucide-react` | `ExternalLink` | |
| `Menu` | `lucide-react` | `Menu` | |
| `MoreHoriz` | `lucide-react` | `Ellipsis` | |
| `Remove` | `lucide-react` | `Minus` | |
| `Save` | `lucide-react` | `Save` | |
| `Search` | `lucide-react` | `Search` | |
| `Sync` | `lucide-react` | `RefreshCw` | |
| `Tune`, `TuneRounded` | `lucide-react` | `SlidersHorizontal` | "Tune" in MUI is sliders |

### Status, info, alerts

| MUI name | Replacement library | Replacement export | Notes |
| --- | --- | --- | --- |
| `Error`, `ErrorOutlineOutlined`, `ErrorOutlineRounded` | `lucide-react` | `CircleAlert` | |
| `HourglassEmpty` | `lucide-react` | `Hourglass` | |
| `InfoOutlined` | `lucide-react` | `Info` | |
| `ReportProblem` | `lucide-react` | `TriangleAlert` | |
| `Verified` | `lucide-react` | `BadgeCheck` | |

### Navigation, layout

| MUI name | Replacement library | Replacement export | Notes |
| --- | --- | --- | --- |
| `AccountTree` | `lucide-react` | `Network` | "Account tree" reads as a hierarchy diagram |
| `BarChart` | `lucide-react` | `ChartColumn` | |
| `Dashboard`, `DashboardOutlined` | `lucide-react` | `LayoutDashboard` | |
| `Layers` | `lucide-react` | `Layers` | |
| `ListAltOutlined` | `lucide-react` | `ClipboardList` | |
| `FormatListBulleted` | `lucide-react` | `List` | |
| `ViewAgenda` | `lucide-react` | `LayoutList` | Stacked rows |
| `ViewList` | `lucide-react` | `List` | |
| `ViewQuilt` | `lucide-react` | `LayoutGrid` | |
| `Place` | `lucide-react` | `MapPin` | |

### Reading, books, content

| MUI name | Replacement library | Replacement export | Notes |
| --- | --- | --- | --- |
| `Book` | `lucide-react` | `Book` | |
| `BookmarkBorder` | `lucide-react` | `Bookmark` | Stroke style — toggle `fill="currentColor"` for filled state |
| `CollectionsBookmark` | `lucide-react` | `BookMarked` | |
| `Description` | `lucide-react` | `FileText` | "Description" in MUI is a document with text lines |
| `LibraryBooks`, `MenuBook`, `MenuBookOutlined` | `lucide-react` | `BookOpen` | |
| `MovieOutlined` | `lucide-react` | `Film` | |
| `SportsEsportsOutlined` | `lucide-react` | `Gamepad2` | |
| `ArticleOutlined` | `lucide-react` | `FileText` | |
| `FormatQuote`, `FormatQuoteRounded` | `lucide-react` | `Quote` | |
| `CopyrightOutlined` | `lucide-react` | `Copyright` | |

### Engagement (rating, social, reactions)

| MUI name | Replacement library | Replacement export | Notes |
| --- | --- | --- | --- |
| `Star`, `StarRounded` | `lucide-react` | `Star` | Filled state via `fill="currentColor"` (see `RatingInput`) |
| `StarBorder` | `lucide-react` | `Star` | Same glyph, no `fill` |
| `Favorite` | `lucide-react` | `Heart` | Filled via `fill="currentColor"` |
| `FavoriteBorder` | `lucide-react` | `Heart` | Outline (no `fill`) |
| `ThumbUp`, `ThumbUpOutlined` | `lucide-react` | `ThumbsUp` | |
| `ThumbDown`, `ThumbDownOutlined` | `lucide-react` | `ThumbsDown` | |
| `RateReviewOutlined` | `lucide-react` | `MessageSquareText` | A speech bubble with lines reads as "review" |
| `Comment` | `lucide-react` | `MessageCircle` | |
| `Forum` | `lucide-react` | `MessagesSquare` | Multiple bubbles = forum |
| `Feedback`, `FeedbackOutlined` | `lucide-react` | `MessageCircleQuestion` | |
| `PushPin`, `PushPinOutlined`, `PushPinRounded` | `lucide-react` | `Pin` | |

### User, account, security

| MUI name | Replacement library | Replacement export | Notes |
| --- | --- | --- | --- |
| `AccountCircle`, `AccountCircleOutlined` | `lucide-react` | `CircleUser` | |
| `Person` | `lucide-react` | `User` | |
| `People` | `lucide-react` | `Users` | |
| `GroupsOutlined` | `lucide-react` | `Users` | |
| `ManageAccountsOutlined` | `lucide-react` | `UserCog` | |
| `HowToReg`, `HowToRegOutlined` | `lucide-react` | `UserCheck` | "Registered" → user with checkmark |
| `Login`, `LoginOutlined` | `lucide-react` | `LogIn` | |
| `AdminPanelSettingsOutlined` | `lucide-react` | `ShieldUser` | Admin shield with user silhouette |
| `Security` | `lucide-react` | `ShieldCheck` | |
| `Key`, `KeyOutlined` | `lucide-react` | `Key` | |
| `VpnKeyOutlined` | `lucide-react` | `KeyRound` | |
| `Email`, `EmailOutlined` | `lucide-react` | `Mail` | |
| `Notifications`, `NotificationsOutlined`, `NotificationsRounded` | `lucide-react` | `Bell` | |
| `Settings` | `lucide-react` | `Settings` | |
| `Link` | `lucide-react` | `Link` | |

### Theme, palette, preferences

| MUI name | Replacement library | Replacement export | Notes |
| --- | --- | --- | --- |
| `Brightness4` | `lucide-react` | `Moon` | Dark-mode toggle (currently dark) |
| `Brightness7` | `lucide-react` | `Sun` | Light-mode toggle (currently light) |
| `PaletteOutlined` | `lucide-react` | `Palette` | |
| `Language` | `lucide-react` | `Languages` | |
| `ScienceOutlined` | `lucide-react` | `FlaskConical` | "Experiments" / labs |

### Commerce, infrastructure

| MUI name | Replacement library | Replacement export | Notes |
| --- | --- | --- | --- |
| `ShoppingCart` | `lucide-react` | `ShoppingCart` | |
| `Inventory2` | `lucide-react` | `Package` | |
| `StorageOutlined` | `lucide-react` | `Database` | |
| `StyleOutlined` | `lucide-react` | `Tags` | "Style" = label/tag stack in MUI |
| `ManageSearchOutlined` | `lucide-react` | `SearchCheck` | |
| `SupportAgentOutlined` | `lucide-react` | `Headset` | |
| `CleaningServicesRounded` | `lucide-react` | `Brush` | |
| `CampaignRounded` | `lucide-react` | `Megaphone` | |
| `DragIndicatorRounded` | `lucide-react` | `GripVertical` | Drag handle |

### Media, files, upload

| MUI name | Replacement library | Replacement export | Notes |
| --- | --- | --- | --- |
| `CameraAlt` | `lucide-react` | `Camera` | |
| `CloudUpload` | `lucide-react` | `CloudUpload` | |
| `Computer` | `lucide-react` | `Monitor` | Used for active sessions |

### Visibility (form fields)

| MUI name | Replacement library | Replacement export | Notes |
| --- | --- | --- | --- |
| `Visibility` | `lucide-react` | `Eye` | |
| `VisibilityOff` | `lucide-react` | `EyeOff` | |

### Counting glyphs (badges)

| MUI name | Replacement library | Replacement export | Notes |
| --- | --- | --- | --- |
| `LooksOneOutlined` | `@tabler/icons-react` | `IconNumber1` | `lucide-react` lacks numbered circle glyphs |
| `LooksTwoOutlined` | `@tabler/icons-react` | `IconNumber2` | |
| `Looks3Outlined` | `@tabler/icons-react` | `IconNumber3` | |
| `PlaylistAddOutlined` | `lucide-react` | `ListPlus` | |
| `PostAddOutlined` | `lucide-react` | `FilePlus` | |

### Brand marks (third-party logos)

Brand marks are not policy icons — they identify external services. `lucide-react` ships a small set under stable names. For marks not present in `lucide-react`, fall back to `@tabler/icons-react` (`IconBrand*`); if neither has it, author an inline `<svg>` primitive.

| MUI name | Replacement library | Replacement export | Notes |
| --- | --- | --- | --- |
| `GitHub` | `lucide-react` | `Github` | |
| `Google` | `@tabler/icons-react` | `IconBrandGoogle` | No Google mark in lucide; tabler ships an official-shape glyph. If `@tabler/icons-react` is not yet in deps, author an inline brand SVG primitive instead. |
| `Telegram` | `@tabler/icons-react` | `IconBrandTelegram` | Not in lucide |
| `Twitter` | `@tabler/icons-react` | `IconBrandTwitter` | Not in lucide |
| `Facebook` | `lucide-react` | `Facebook` | |
| `Instagram` | `lucide-react` | `Instagram` | |

## When you don't see a mapping

1. **Search `lucide-react` first** at `https://lucide.dev/icons/`.
2. If nothing fits, search `@tabler/icons-react` at `https://tabler.io/icons`. If this is the first tabler glyph used in the codebase, also add `@tabler/icons-react` to `package/ui/package.json` `dependencies` in the same change.
3. If neither library has a fitting glyph (vendor logos, brand-specific affordances), author an inline `<svg>` primitive under `package/ui/src/primitive/icon/`. **Do not** add a third icon library.
4. **Add the new mapping to this table** in the same change that introduces the migration.

## Sizing & color examples

```tsx
// Body-sized icon, inherits text color
<Search className="w-4 h-4" />

// UI affordance with explicit token color
<Bell className="w-5 h-5 text-[var(--rezics-color-text-secondary)]" />

// Filled rating star (see RatingInput)
<Star
  className="w-5 h-5"
  fill="currentColor"
  style={{ color: "var(--rezics-color-brand-fill)" }}
/>

// Outlined rating star
<Star
  className="w-5 h-5"
  style={{ color: "var(--rezics-color-text-tertiary)" }}
/>
```

Never:

```tsx
// ❌ numeric size prop
<Search size={20} />

// ❌ hex color
<Bell className="w-5 h-5 text-[#1d1d1f]" />

// ❌ emoji as affordance
<button>✕</button>
```

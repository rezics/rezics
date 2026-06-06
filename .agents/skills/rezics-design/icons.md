# Icon Vocabulary — Canonical Reference

This file is the canonical reference for the rezics icon system. Read this **before** picking an icon.

## Top-Level Rules

1. **Brand marks come from `@rezics/icons`.** First-party rezics-owned brand icon library — covers Github, Google, Microsoft, Telegram, X, Facebook, Instagram, Apple, Discord, LinkedIn, Reddit, YouTube, TikTok, Spotify, Twitch, Pinterest, Snapchat, Signal, Skype, Tumblr, VK, Meta, Metamask, Medium, Dribbble, Figma. Use the colored `*Icon` exports for full-color brand glyphs; use `*GrayIcon` variants when the icon must inherit `currentColor`. **Never** use `lucide-react` or `@tabler/icons-react` for brand marks: lucide has removed its brand icons (current versions throw `does not provide an export named 'Github'`), and tabler's `IconBrand*` family is also not the canonical source here.
2. **`lucide-react` is the default icon source for non-brand glyphs.** Reach for it first.
3. **`@tabler/icons-react` is the named fallback** when `lucide-react` lacks a non-brand glyph. Add the package to `@rezics/ui` `dependencies` only on first use; do not preempt.
4. **No fourth icon library.** Non-brand glyphs that neither lucide nor tabler carry become inline `<svg>` primitives owned by rezics under `package/ui/src/primitive/icon/`.
5. **No emoji in UI chrome.** Emoji are content (user posts, comments). Affordances — close, menu, expand, star, check, arrows — are icons.
6. **Named imports only:** `import { Star } from "lucide-react"`, `import { GithubIcon } from "@rezics/icons"`. Never barrel imports.
7. **Sizing via UnoCSS classes:** `w-4 h-4` (body), `w-5 h-5` (UI affordances), `w-6 h-6` (emphasized buttons). Avoid the numeric `size={…}` prop.
8. **Color via `currentColor`.** Override with `text-*` UnoCSS classes pointing to `--colors-*` tokens — never hex. Exception: colored `*Icon` brand variants from `@rezics/icons` paint their own canonical brand colors and ignore `text-*` overrides; use `*GrayIcon` variants when token-driven color is required.

## Picking a non-brand icon

1. **Search `lucide-react` first** at `https://lucide.dev/icons/`.
2. If nothing fits, search `@tabler/icons-react` at `https://tabler.io/icons`. If this is the first tabler glyph used in the codebase, also add `@tabler/icons-react` to `package/ui/package.json` `dependencies` in the same change.
3. If neither library has a fitting glyph, author an inline `<svg>` primitive under `package/ui/src/primitive/icon/`. **Do not** add a third icon library.

For filled vs outlined affordances (e.g. favorite filled vs unfilled), use the same `lucide-react` glyph and toggle the visual via `fill="currentColor"` and `text-*` color, not by swapping icon names.

## Categories the codebase uses

These are not exhaustive lists — they are the categories where consistent picks matter. Within each, default to `lucide-react`.

- **General actions:** `Plus`, `Minus`, `X`, `Check`, `Pencil`, `Trash2`, `Copy`, `Save`, `Search`, `Menu`, `Ellipsis`, `EllipsisVertical`, `Filter`, `SlidersHorizontal`, `RefreshCw`, `LogOut`, `ExternalLink`, `Share`, `ArrowLeft`/`ArrowRight`/`ArrowUp`/`ArrowDown`, `ChevronLeft`/`ChevronRight`/`ChevronUp`/`ChevronDown`, `ChevronsUpDown`/`ChevronsDownUp`, `GripVertical`.
- **Status / alerts:** `CircleCheck`, `CircleAlert`, `TriangleAlert`, `Info`, `BadgeCheck`, `Hourglass`, `Bug`.
- **Navigation / layout:** `LayoutDashboard`, `LayoutGrid`, `LayoutList`, `List`, `ClipboardList`, `Network`, `Layers`, `MapPin`, `ChartColumn`.
- **Reading / content:** `Book`, `BookOpen`, `BookMarked`, `Bookmark`, `BookmarkPlus`, `FileText`, `Film`, `Gamepad2`, `Quote`, `Copyright`.
- **Engagement / reactions:** `Star`, `Heart`, `ThumbsUp`, `ThumbsDown`, `MessageCircle`, `MessagesSquare`, `MessageSquareText`, `MessageCircleQuestion`, `Pin`. Use `fill="currentColor"` to flip outline → filled state on the same glyph.
- **User / account / security:** `User`, `Users`, `CircleUser`, `UserCog`, `UserCheck`, `LogIn`, `ShieldUser`, `ShieldCheck`, `Key`, `KeyRound`, `Mail`, `Bell`, `Settings`, `Link`.
- **Theme / preferences:** `Moon`/`Sun` (theme toggle), `Palette`, `Languages`, `FlaskConical` (experiments).
- **Commerce / infrastructure:** `ShoppingCart`, `Package`, `Database`, `Tag`/`Tags`, `SearchCheck`, `Headset`, `Brush`, `Megaphone`.
- **Media / files:** `Camera`, `CloudUpload`, `Monitor`, `Image`.
- **Form fields:** `Eye`/`EyeOff` (visibility toggles).
- **List / post composition:** `ListPlus`, `FilePlus`.
- **Numbered badges (1, 2, 3):** `IconNumber1` / `IconNumber2` / `IconNumber3` from `@tabler/icons-react` — `lucide-react` has no numbered-circle glyphs.

## Brand marks (from `@rezics/icons`)

Brand marks identify external services and **must come from `@rezics/icons`**. Use the colored `*Icon` export for full-color brand glyphs (recommended for footers, share dialogs, auth buttons); use the `*GrayIcon` variant when the icon must inherit `currentColor` from a button/text context.

| Service       | Colored export        | Gray (currentColor) export |
| ------------- | --------------------- | -------------------------- |
| GitHub        | `GithubIcon`          | `GithubGrayIcon`           |
| Google        | `GoogleIcon`          | `GoogleGrayIcon`           |
| Microsoft     | `MicrosoftIcon`       | `MicrosoftGrayIcon`        |
| Telegram      | `TelegramIcon`        | `TelegramGrayIcon`         |
| X (Twitter)   | `XIcon`               | `XGrayIcon`                |
| Facebook      | `FacebookIcon`        | `FacebookGrayIcon`         |
| Instagram     | `InstagramIcon`       | `InstagramGrayIcon`        |
| Apple         | `AppleIcon`           | `AppleGrayIcon`            |
| Discord       | `DiscordIcon`         | `DiscordGrayIcon`          |
| LinkedIn      | `LinkedinIcon`        | `LinkedinGrayIcon`         |
| Reddit        | `RedditIcon`          | `RedditGrayIcon`           |
| YouTube       | `YoutubeIcon`         | `YoutubeGrayIcon`          |
| TikTok        | `TiktokIcon`          | `TiktokGrayIcon`           |
| Spotify       | `SpotifyIcon`         | `SpotifyGrayIcon`          |
| Twitch        | `TwitchIcon`          | `TwitchGrayIcon`           |
| Pinterest     | `PinterestIcon`       | `PinterestGrayIcon`        |
| Snapchat      | `SnapchatIcon`        | `SnapchatGrayIcon`         |
| Signal        | `SignalIcon`          | `SignalGrayIcon`           |
| Skype         | `SkypeIcon`           | `SkypeGrayIcon`            |
| Tumblr        | `TumblrIcon`          | `TumblrGrayIcon`           |
| VK            | `VkIcon`              | `VkGrayIcon`               |
| Meta          | `MetaIcon`            | `MetaGrayIcon`             |
| MetaMask      | `MetamaskIcon`        | `MetamaskGrayIcon`         |
| Medium        | `MediumIcon`          | `MediumGrayIcon`           |
| Dribbble      | `DribbbleIcon`        | `DribbbleGrayIcon`         |
| Figma         | `FigmaIcon`           | `FigmaGrayIcon`            |

If a brand glyph is needed that `@rezics/icons` does not yet export, add the SVG to that package (it lives at `node_modules/@rezics/icons` published from a sibling repo) and bump its version — do not reach for lucide/tabler as a workaround.

## Sizing & color examples

```tsx
// Body-sized icon, inherits text color
<Search className="w-4 h-4" />

// UI affordance with explicit token color
<Bell className="w-5 h-5 text-[var(--colors-text-secondary)]" />

// Filled rating star (see RatingInput)
<Star
  className="w-5 h-5"
  fill="currentColor"
  style={{ color: "var(--colors-brand-fill)" }}
/>

// Outlined rating star
<Star
  className="w-5 h-5"
  style={{ color: "var(--colors-text-tertiary)" }}
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

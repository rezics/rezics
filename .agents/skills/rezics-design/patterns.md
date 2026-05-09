# Patterns — Do / Don't

Code-level patterns. The "why" is in voice.md; the "what to use" is in tokens.md. This is the "how it should look in JSX/CSS".

---

## 1. Section / page layout

### ✅ DO — borderless, whitespace-separated

```tsx
<section className="py-16">
  <h2 className="text-2xl mb-8">Recent Books</h2>
  <div className="grid grid-cols-4 gap-8">
    {books.map((b) => <BookCard key={b.id} book={b} />)}
  </div>
</section>

<section className="py-16">
  <h2 className="text-2xl mb-8">Reading Lists</h2>
  {/* ... */}
</section>
```

Sections separate via `py-12` (48px) or `py-16` (64px) vertical padding. No card wrap, no border, no shadow.

### ❌ DON'T — bordered card chrome around sections

```tsx
{/* WRONG */}
<div className="p-8 mb-8 border border-gray-200 shadow-sm rounded-lg">
  <h2 className="text-2xl">Recent Books</h2>
  {/* ... */}
</div>
```

Bordered/shadowed section cards are the SaaS-dashboard look. rezics is a library — sections breathe through whitespace.

---

## 2. Cards (book / item / post)

### ✅ DO — minimal chrome, content-led

```tsx
<article className="flex flex-col">
  <img
    src={book.cover}
    alt={book.title}
    className="aspect-[2/3] w-full rounded-md object-cover"
  />
  <div className="pt-3">
    <p className="font-medium text-text-primary">{book.title}</p>
    <p className="text-sm text-text-secondary">{book.author}</p>
  </div>
</article>
```

Image, title, author — that's the card. The cover art carries the visual weight.

### ✅ DO — list-row card with whisper border

```tsx
<ul className="divide-y divide-border-whisper">
  {posts.map((p) => (
    <li key={p.id} className="py-6">
      {/* row content */}
    </li>
  ))}
</ul>
```

Whisper border for table-row separation is fine. It's containment, not chrome.

### ❌ DON'T — heavy card

```tsx
{/* WRONG */}
<div className="p-6 mb-4 border border-gray-300 rounded-2xl shadow-md">
  <img ... />
  <div>...</div>
</div>
```

---

## 3. Buttons

### ✅ DO — shadcn `Button` with brand variant

```tsx
import { Button } from "@rezics/ui/shadcn";

<Button>Save</Button>
{/* default → brand-fill background, text-on-brand. The default variant is the primary brand action. */}

<Button variant="outline">Cancel</Button>
{/* outline → bordered, text-text-primary. Secondary actions. */}

<Button variant="ghost">More</Button>
{/* ghost → no chrome until hover. Tertiary / inline actions. */}
```

The shadcn `Button` is token-aligned via the flat `--colors-*` cascade and already wired to the rezics aesthetic.

### ❌ DON'T — hand-rolled brand button

```tsx
{/* WRONG — bypasses tokens */}
<button style={{ background: '#f4606c', color: 'white', padding: '8px 16px', borderRadius: 8 }}>
  Save
</button>
```

### ❌ DON'T — emoji in label

```tsx
{/* WRONG */}
<Button>✨ Get started</Button>
```

If the action needs an icon, compose it inside the button:

```tsx
import { Plus } from "lucide-react";

<Button>
  <Plus className="w-4 h-4" />
  Add book
</Button>
```

---

## 4. Form inputs

### ✅ DO — shadcn `Input` + `Label`

```tsx
import { Input, Label } from "@rezics/ui/shadcn";

<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" />
</div>
```

The shadcn `Input` is borderless-by-default and matches the rezics aesthetic. Fields look like editable text on the page, not boxed widgets.

### ✅ DO — shadcn `Field` family for grouping

For grouped form rows with description and error message, use the shadcn `Field` family (`FieldGroup`, `FieldLabel`, `FieldDescription`, `FieldError`).

### ❌ DON'T — hand-rolled input

```tsx
{/* WRONG */}
<input
  className="border border-gray-300 rounded p-2 focus:border-blue-500"
  placeholder="Email"
/>
```

If shadcn doesn't fit, see `component-selection.md` for whether to author a custom primitive.

---

## 5. Links

### ✅ DO — `<SafeLink>` for any href

```tsx
import { SafeLink } from '@rezics/ui';

<SafeLink href={url}>Read on Goodreads</SafeLink>
```

`<SafeLink>` classifies external URLs and routes them through a confirmation modal (see `openspec/specs/outbound-link-protection/spec.md`). Enforced by R5 in `bun run check:convention`.

### ❌ DON'T — raw `<a href>`

```tsx
{/* WRONG — fails check:convention */}
<a href={url}>Read on Goodreads</a>
```

### ✅ DO — `<TextLink>` for in-app navigation

```tsx
import { TextLink } from '@rezics/ui';

<TextLink to="/books/$id" params={{ id: book.id }}>
  {book.title}
</TextLink>
```

`<TextLink>` is the rezics-themed, TanStack Router–integrated link primitive for internal navigation. For anything that leaves rezics, use `<SafeLink>`.

---

## 6. Icons

### ✅ DO — `lucide-react` (default) or `@tabler/icons-react` (named fallback)

```tsx
import { Bookmark, Heart } from "lucide-react";

<button aria-label="Bookmark"><Bookmark className="w-5 h-5" /></button>
<Heart className="w-4 h-4" />
```

`lucide-react` is the default. Reach for `@tabler/icons-react` only when lucide lacks the glyph (see `icons.md`). Brand marks come from `@rezics/icons`.

### ❌ DON'T — emoji as UI icon

```tsx
{/* WRONG */}
<button>📚 My Library</button>
<span>❤️ Like</span>
```

Emoji are content — what users post. They're not UI vocabulary.

### ❌ DON'T — inline SVG glob

```tsx
{/* WRONG — no token integration */}
<svg viewBox="0 0 24 24"><path d="..." /></svg>
```

Use the icon libraries; they integrate with `currentColor` and UnoCSS sizing classes. Inline `<svg>` primitives are only allowed when authored under `package/ui/src/primitive/icon/` after both lucide and tabler are confirmed missing the glyph.

---

## 7. Color usage

### ✅ DO — token-driven

```tsx
{/* UnoCSS classes */}
<div className="bg-surface-base text-text-primary p-4 rounded-md">...</div>

{/* CSS vars (raw style or :root) */}
<div style={{ background: 'var(--colors-surface-base)' }}>...</div>
```

### ❌ DON'T — hex literals

```tsx
{/* WRONG */}
<div style={{ background: '#f5f4ed', color: '#1d1d1f' }} />
<div className="bg-[#faf9f5]">...</div>
```

Hex literals lock you out of dark mode and break the token contract.

### ❌ DON'T — `#f4606c` as text color

```tsx
{/* WRONG — fails AA contrast */}
<p style={{ color: '#f4606c' }}>Brand label</p>
<span className="text-[#f4606c]">Brand label</span>
```

```tsx
{/* RIGHT — auto-resolves to #C4433A light / #fa7882 dark */}
<p style={{ color: 'var(--colors-text-brand)' }}>Brand label</p>
<span className="text-text-brand">Brand label</span>
```

---

## 8. Typography

### ✅ DO — UnoCSS scale + token classes

```tsx
<h2 className="text-2xl font-medium leading-ui">Recent Reviews</h2>
<p className="text-base leading-body">Lorem ipsum...</p>
<p className="text-xs text-text-secondary">3 days ago</p>
```

The scale uses `clamp()` viewport-responsive sizes (`text-xs` → `text-3xl`, plus `text-reader` for book content). Headings default to medium (500) weight.

### ✅ DO — serif for book reader

```tsx
<div className="font-serif text-reader leading-reader">
  {chapterContent}
</div>
```

### ❌ DON'T — fixed pixel sizes

```tsx
{/* WRONG — bypasses clamp scale */}
<h2 style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>Recent Reviews</h2>
```

Three problems: hardcoded size (no clamp), 700 weight (too heavy for editorial), 1.2 line-height (below 1.30 minimum).

### ❌ DON'T — bold weight everywhere

```tsx
{/* WRONG — fights editorial mood */}
<h1 className="font-bold">Books</h1>
```

Default headings to medium (500). Reserve heavier weights for the rare emphatic moment.

---

## 9. Spacing

### ✅ DO — token-aligned

```tsx
{/* UnoCSS: p-N = N × 4px (Tailwind v4). Common steps: p-2 (8px), p-4 (16px), p-6 (24px), p-8 (32px), p-12 (48px), p-16 (64px). */}
<div className="p-4 gap-8">...</div>
```

### ❌ DON'T — odd values

```tsx
{/* WRONG */}
<div className="p-[13px] gap-[22px]">...</div>
```

Off-grid values introduce visual jitter. If the closest token feels wrong, propose a token addition; don't escape hatches.

---

## 10. Mode (light/dark) handling

### ✅ DO — let tokens auto-switch

```tsx
{/* This works in both modes — no `prefers-color-scheme` check needed */}
<div className="bg-surface-base text-text-primary">
  <p>Auto light/dark.</p>
</div>
```

### ❌ DON'T — branch on mode in components

```tsx
{/* WRONG */}
const isDark = document.documentElement.dataset.theme === 'dark';
const bg = isDark ? '#1a1a18' : '#f5f4ed';
<div style={{ background: bg }}>...</div>
```

If a token doesn't exist for what you need, propose adding one; don't branch on mode in component code.

---

## 11. Mock data convention

When the backend isn't ready yet (Frontend-First development):

### ✅ DO — comment with `// MOCK:`

```ts
// MOCK: view count derived from book id hash
function mockViewCount(id: string | number): number {
  return (hashCode(String(id)) % 5000) + 10;
}

// MOCK: deterministic placeholder reviews until /api/reviews is implemented
const mockReviews: Review[] = [...];
```

The `// MOCK:` annotation lets `grep -r "// MOCK:"` find every placeholder when the backend lands.

### ❌ DON'T — silent placeholders

```ts
{/* WRONG — no way to find this later */}
const reviews: Review[] = [
  { id: 1, title: "Great book", body: "..." },
];
```

---

## 12. Admin vs App density

### Admin (operations, dense)

```tsx
{/* table rows ~40px tall, p-3/p-4 padding (12–16px) */}
<tr className="h-10">
  <td className="py-3 px-4">{user.name}</td>
  <td className="py-3 px-4">{user.email}</td>
</tr>
```

### App (browsing, generous)

```tsx
{/* generous breathing in user-facing surfaces */}
<div className="space-y-8 py-16">
  <BookSection />
  <ReviewSection />
  <ShelfSection />
</div>
```

Admin ≠ App. Don't replicate app-side layouts in admin; the audiences and tasks differ.

---

## 13. Abstraction vs Split

When two components look similar, decide whether they're **one component with a variant prop** or **two separate components**. Apply three tests in order — the first failure decides.

### Layout test

Do the render trees differ structurally (different children, different slots, different number of regions)? **Split.** A `variant` prop that swaps the JSX tree is the prop telling you it shouldn't exist.

### Naming test

Could the variants share *one* component name without a qualifier?

- `Default / Compact / Small / Medium / Large / LongContent / LocaleCJK` — these name an axis on one component → **variant prop**.
- `Hero / Sidebar / Inline / Embedded` — these name *what something is*, not which mode → **split**.

### Evolution test

If the next feature needs a new sub-region for one variant only, will the prop API still feel like one component? If you'd add `showHeader`, `headerSlot`, `headerVariant` just to satisfy one variant, **split** before that grows.

### 10-second story-name heuristic

Look at the story names you'd write. If the list is `Default / Compact / Large` you have a variant axis. If the list is `Hero / Compact / Sidebar` you have multiple components (the names label *kinds*, not *modes*).

### Worked examples

| Decision | Why | Story IDs |
|---|---|---|
| `BookCardHorizontal` vs `BookCardVertical` — split | Layout test fires (cover-left vs cover-top). | `Domain/Book/HorizontalBookCard--default`, `Domain/Book/VerticalBookCard--default` |
| `ColorfulButton color="green | orange | rose"` — variant | Same shape, color axis only. | `Primitive/Button/ColorfulButton--green` |
| `ReactionBar size="small | medium | large"` — variant | Same shape, size axis only. | `App/Engagement/ReactionBar--sm-thread-row`, `--md-discussion-card`, `--lg-detail-surface` |
| `ReviewCardPair` — composition (not split, not variant) | Composes two `ReviewCard`s rather than duplicating. Layout test fires; naming test passes (`Pair` *is* what it is). | `Domain/Review/ReviewCardPair--default` |
| `PostCard` vs `PostReply` — split | 17% prop overlap; PostReply renders threading rail + collapse toggle that PostCard doesn't have. | `Domain/Post/PostCard--default`, `Domain/Post/PostReply--default` |
| `DomainCarousel` — generic | Four domain wrappers (`HorizontalBookCarousel`, etc.) shim through this. Naming test: each wrapper has its own name; the generic stays headless. | `Composite/Carousel/DomainCarousel--default` |

The full prose version of this section lives in [`Foundation/Patterns#13`](./../../package/ui/src/docs/patterns.mdx) with side-by-side `<Compare>` blocks.

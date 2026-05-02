# Patterns — Do / Don't

Code-level patterns. The "why" is in voice.md; the "what to use" is in tokens.md. This is the "how it should look in JSX/CSS".

---

## 1. Section / page layout

### ✅ DO — borderless, whitespace-separated

```tsx
<Box sx={{ py: 8 }}>
  <Typography variant="h2" mb={4}>Recent Books</Typography>
  <Grid container spacing={4}>
    {books.map((b) => <BookCard key={b.id} book={b} />)}
  </Grid>
</Box>

<Box sx={{ py: 8 }}>
  <Typography variant="h2" mb={4}>Reading Lists</Typography>
  {/* ... */}
</Box>
```

Sections separate via `space-8` (48px) vertical padding. No card wrap, no border, no shadow.

### ❌ DON'T — bordered card chrome around sections

```tsx
{/* WRONG */}
<Card sx={{ p: 4, mb: 4, border: '1px solid #ddd', boxShadow: 1 }}>
  <Typography variant="h2">Recent Books</Typography>
  {/* ... */}
</Card>
```

Bordered/shadowed section cards are the SaaS-dashboard look. rezics is a library — sections breathe through whitespace.

---

## 2. Cards (book / item / post)

### ✅ DO — minimal chrome, content-led

```tsx
<Card sx={{ p: 0, bgcolor: 'transparent', border: 'none', boxShadow: 'none' }}>
  <CardMedia component="img" image={book.cover} sx={{ aspectRatio: '2/3', borderRadius: 1 }} />
  <Box sx={{ pt: 1.5 }}>
    <Typography variant="body1" fontWeight={500}>{book.title}</Typography>
    <Typography variant="body2" color="text.secondary">{book.author}</Typography>
  </Box>
</Card>
```

Image, title, author — that's the card. The cover art carries the visual weight.

### ✅ DO — list-row card with whisper border

```tsx
<Stack divider={<Divider sx={{ borderColor: 'var(--rzc-color-border-whisper)' }} />}>
  {posts.map((p) => (
    <Box key={p.id} sx={{ py: 3 }}>
      {/* row content */}
    </Box>
  ))}
</Stack>
```

Whisper border for table-row separation is fine. It's containment, not chrome.

### ❌ DON'T — heavy card

```tsx
{/* WRONG */}
<Card sx={{ p: 3, mb: 2, border: '1px solid #e0e0e0', borderRadius: 3, boxShadow: 2 }}>
  <CardMedia ... />
  <CardContent>...</CardContent>
</Card>
```

---

## 3. Buttons

### ✅ DO — MUI Button with brand variant

```tsx
import Button from '@mui/material/Button';

<Button variant="contained">Save</Button>
{/* contained → palette.primary.main = #f4606c, contrastText = white */}

<Button variant="outlined">Cancel</Button>
{/* outlined → border + brand text. Uses brand color via theme. */}

<Button variant="text">More</Button>
{/* text → ghost button, brand text only */}
```

The theme's `MuiButton.defaultProps` sets `variant: "contained"` and `disableElevation: true`. So a bare `<Button>...</Button>` is already correct.

### ❌ DON'T — hand-rolled brand button

```tsx
{/* WRONG — bypasses theme */}
<button style={{ background: '#f4606c', color: 'white', padding: '8px 16px', borderRadius: 8 }}>
  Save
</button>
```

### ❌ DON'T — emoji in label

```tsx
{/* WRONG */}
<Button>✨ Get started</Button>
```

If the action needs an icon, use `startIcon`:

```tsx
import AddIcon from '@mui/icons-material/Add';
<Button startIcon={<AddIcon />}>Add book</Button>
```

---

## 4. Form inputs

### ✅ DO — MUI TextField, standard variant

```tsx
import TextField from '@mui/material/TextField';

<TextField label="Email" variant="standard" fullWidth />
```

The standard (not outlined) variant matches the borderless aesthetic. Fields look like editable text on the page, not boxed widgets.

### ✅ DO — outlined for admin / dense forms

```tsx
<TextField label="Title" variant="outlined" size="small" />
```

Admin and editor surfaces use outlined for clarity. App side prefers standard.

### ❌ DON'T — hand-rolled input

```tsx
{/* WRONG */}
<input
  className="border border-gray-300 rounded p-2 focus:border-blue-500"
  placeholder="Email"
/>
```

If MUI doesn't fit, reach for shadcn. See `mui-vs-shadcn.md`.

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

### ❌ DON'T — MUI Link to external

```tsx
{/* WRONG — bypasses safety */}
<Link href={externalUrl}>Read on Goodreads</Link>
```

MUI `<Link>` is fine for in-app navigation (TanStack Router, internal anchors). For anything that leaves rezics, `<SafeLink>` only.

---

## 6. Icons

### ✅ DO — Material Icons or Lucide

```tsx
import BookmarkIcon from '@mui/icons-material/BookmarkBorder';
import { Heart } from 'lucide-react';

<IconButton><BookmarkIcon /></IconButton>
<Heart size={16} />
```

`@mui/icons-material` is the default. `lucide-react` for icons MUI lacks (it has them).

### ❌ DON'T — emoji as UI icon

```tsx
{/* WRONG */}
<button>📚 My Library</button>
<span>❤️ Like</span>
```

Emoji are content — what users post. They're not UI vocabulary.

### ❌ DON'T — inline SVG glob

```tsx
{/* WRONG — no theme integration */}
<svg viewBox="0 0 24 24"><path d="..." /></svg>
```

Use the icon libraries; they integrate with theme color and size.

---

## 7. Color usage

### ✅ DO — token-driven

```tsx
{/* MUI sx */}
<Box sx={{ bgcolor: 'background.default', color: 'text.primary' }} />

{/* UnoCSS */}
<div className="bg-surface text-text-primary p-4 rounded-md">...</div>

{/* CSS vars */}
<div style={{ background: 'var(--rzc-color-surface-base)' }}>...</div>
```

### ❌ DON'T — hex literals

```tsx
{/* WRONG */}
<Box sx={{ bgcolor: '#f5f4ed', color: '#1d1d1f' }} />
<div className="bg-[#faf9f5]">...</div>
```

Hex literals lock you out of dark mode and break the token contract.

### ❌ DON'T — `#f4606c` as text color

```tsx
{/* WRONG — fails AA contrast */}
<Typography sx={{ color: '#f4606c' }}>Brand label</Typography>
<span className="text-[#f4606c]">Brand label</span>
```

```tsx
{/* RIGHT — auto-resolves to #C4433A light / #fa7882 dark */}
<Typography sx={{ color: 'var(--rzc-color-text-brand)' }}>Brand label</Typography>
<span className="text-text-brand">Brand label</span>
```

---

## 8. Typography

### ✅ DO — MUI variants

```tsx
<Typography variant="h2">Recent Reviews</Typography>
<Typography variant="body1">Lorem ipsum...</Typography>
<Typography variant="caption" color="text.secondary">3 days ago</Typography>
```

The theme defines all variants with the correct `clamp()` size, weight, and line-height per Foundation v1.

### ✅ DO — serif for book reader

```tsx
<Box sx={{ fontFamily: 'var(--rzc-font-serif)', fontSize: 'var(--rzc-text-reader-or-clamp)', lineHeight: 1.6 }}>
  {chapterContent}
</Box>
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
<Typography variant="h1" fontWeight={700}>Books</Typography>
```

Theme defaults headings to 500 medium. Trust it.

---

## 9. Spacing

### ✅ DO — token-aligned

```tsx
{/* MUI: theme.spacing(1) = 8px = space-2 */}
<Box sx={{ p: 2, gap: 4 }}>...</Box>

{/* UnoCSS: matching scale */}
<div className="p-2 gap-4">...</div>
```

### ❌ DON'T — odd values

```tsx
{/* WRONG */}
<Box sx={{ p: '13px', gap: '22px' }}>...</Box>
<div className="p-[13px] gap-[22px]">...</div>
```

Off-grid values introduce visual jitter. If the closest token feels wrong, propose a token addition; don't escape hatches.

---

## 10. Mode (light/dark) handling

### ✅ DO — let tokens auto-switch

```tsx
{/* This works in both modes — no `prefers-color-scheme` check needed */}
<Box sx={{ bgcolor: 'background.default', color: 'text.primary' }}>
  <Typography>Auto light/dark.</Typography>
</Box>
```

### ❌ DON'T — branch on mode in components

```tsx
{/* WRONG */}
const theme = useTheme();
const bg = theme.palette.mode === 'dark' ? '#1a1a18' : '#f5f4ed';
<Box sx={{ bgcolor: bg }}>...</Box>
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
{/* table rows ~40px tall, space-3/4 padding */}
<TableRow sx={{ height: 40 }}>
  <TableCell sx={{ py: 1.5, px: 2 }}>{user.name}</TableCell>
  <TableCell sx={{ py: 1.5, px: 2 }}>{user.email}</TableCell>
</TableRow>
```

### App (browsing, generous)

```tsx
{/* generous breathing in user-facing surfaces */}
<Stack spacing={4} sx={{ py: 8 }}>
  <BookSection />
  <ReviewSection />
  <ShelfSection />
</Stack>
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

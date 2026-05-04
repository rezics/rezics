# Design Voice — rezics

## Mood

**Parchment archive, not glass dashboard.** rezics is a library — books, games, media, posts, reviews, quotes, threaded discussions. The interface should feel like a curated catalog, not a SaaS console.

The mood is composed of:

- **Editorial restraint** — pages breathe. Headings carry weight through size and spacing, not bold weight or borders. Reading-first surfaces (book content, 書評) use the serif family; UI surfaces use sans.
- **Warm restraint** — parchment `#f5f4ed` and warm dark stone `#1a1a18` are the foundation. Pure white and pure black are forbidden as canvas. The brand color 轮回红 `#f4606c` punctuates without dominating.
- **Density when warranted** — the app side (book browsing, reading) is generous; the admin side (operations) is dense and efficient. Each surface earns its rhythm.
- **Quietly expressive** — small things are allowed to delight (press scale to 0.98, subtle hover transitions at 200ms), but never decorative shadows, gradients, or animation for its own sake.

## Tone

| Surface                  | Tone                                                                |
| ------------------------ | ------------------------------------------------------------------- |
| Library / 書庫 / 媒體庫   | Catalog, neutral, scholarly. Let cover art and titles do the talking. |
| Reader (book content)    | Disappear. The interface is a margin around the text.               |
| 書評 (long-form reviews) | Editorial weekly — serif body, generous line-height, restrained chrome. |
| Post forum               | Conversational but unornamented. No bubbles, no rounded chat balloons. |
| Reddit-style threads     | Hierarchical, dense, scannable. Tree visible through indentation alone. |
| Tag system               | Inline, small caps not allowed; pill-shaped for status, otherwise plain. |
| Admin                    | Functional, terse, dense tables. No marketing tone.                 |
| Auth / settings          | Plain forms, borderless inputs, no flourishes.                      |

## Don't say

- **Don't be playful in chrome copy.** Button labels are verbs ("Save", "Publish"), not phrases ("Get started ✨"). Microcopy is short and informational.
- **Don't shout.** All-caps is reserved for the `overline` typography variant (small labels). Headings use sentence case.
- **Don't moralize.** Empty states say "No books yet", not "Looks like you haven't added any books — let's fix that!". Match the catalog's voice, not a chatbot's.
- **Don't decorate state with copy.** Errors say what happened, not what the user feels. Loading states show a spinner, not an inspirational quote.

## Reference systems we draw from

| System    | What we borrow                                               |
| --------- | ------------------------------------------------------------ |
| Apple     | Borderless surfaces, weighty SF-style typography, restraint. |
| Notion    | Whisper borders for containment, density, small chrome.      |
| Claude    | Warm parchment foundation, calm chromatic restraint.         |
| Mintlify  | Documentation-grade typography hierarchy, no decoration.     |
| Cursor    | Editorial serif option for long-form reading surfaces.       |

We do **not** draw from:

- **Linear** — too cold and monochrome-blue for a content library.
- **Stripe** — financial-blue chromatics conflict with our warm foundation.
- **Material You / Google** — too playful and dynamic for an archive.
- **Discord / Twitter** — too dense in the wrong way; chat-bubble vocabulary doesn't fit.

## The litmus test

If a designer or AI introduces:
- A bordered card with shadow → wrong mood
- An emoji in the chrome → wrong mood
- A second chromatic accent → wrong mood
- A gradient background → wrong mood
- A heading in 700 weight or all-caps body → wrong mood
- Raw white `#ffffff` as canvas → wrong mood
- Aggressive copywriting → wrong mood

These aren't style nitpicks. They're symptoms of misreading rezics as a SaaS product when it's a library.

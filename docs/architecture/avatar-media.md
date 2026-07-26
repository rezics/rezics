# Avatar media

Avatar media is one complete discriminated value. It is never a collection of
independently inherited fields.

```ts
type Avatar =
	| { type: "image"; image: { assetId: string } }
	| { type: "emoji"; emoji: string }
	| {
			type: "icon";
			icon: { provider: "font-awesome"; prefix: "fas" | "fab"; name: string };
	  };
```

API responses replace an image `assetId` with the presented image `{ id, url }`.
Emoji and icon references are returned unchanged. Mutation fields use these
semantics:

- omitted: preserve the existing localization override;
- `null`: remove the override and inherit;
- object: replace the entire avatar value.

Localization fallback selects the first complete avatar in the established
localization order, preferring the requested language. It must not combine an
icon type from one localization with fields from another.

## Font Awesome delivery

The application uses Font Awesome's provider-native `prefix` and `name`. It
does not persist arbitrary class strings, kit URLs, account tokens, or a
project-defined cross-provider key.

The hosted Kit is a deployment dependency and is not distributed with the GPL
application. Configure it as follows:

1. Use a CSS-only Web Fonts Kit.
2. Pin the Kit to the `FontAwesomeVersion` exported by `@rezics/avatar`.
3. Use **By Style**, with Classic Solid and Brands enabled.
4. Set `FONT_AWESOME_KIT_CSS_URL` to the Kit's HTTPS stylesheet URL.
5. Set `FONT_AWESOME_KIT_LICENSE` to `free` or `pro`. The picker uses this to
   exclude icons unavailable to the deployed Kit.

The browser picker queries Font Awesome's public GraphQL metadata for the
pinned release, debounces requests, validates unknown responses at runtime,
and caches results. The API and database enforce the provider, supported
prefixes, safe icon-name syntax, and coherent union columns. They deliberately
do not make a write depend on Font Awesome availability; ordinary authoring
uses the metadata-backed picker.

## Emoji and images

Emoji is stored as one Unicode grapheme cluster containing an emoji sequence.
This preserves flags, keycaps, skin tones, and ZWJ families without pretending
that an emoji is an icon-font glyph.

The picker uses Frimousse with a pinned, application-hosted Emojibase dataset.
The dataset route exposes only the supported English and Traditional Chinese
documents, sends immutable cache headers, and avoids a runtime dependency on a
third-party CDN. Recently selected emoji are stored locally per picker locale
so their accessible labels stay in the current language.

Images continue to use managed image assets. Only the image variant owns an
asset foreign key. Replacing an avatar with emoji or icon clears that foreign
key and every other inactive payload column.

## ImageAsset presentations

The immutable original and its rendering intent have separate storage
responsibilities:

- `image_object` owns the decoded, auto-oriented width and height alongside
  the original media type and byte size.
- `image_asset_presentation` is a child of `image_asset`, keyed by
  `(asset_id, role)`. It owns `fit`, a normalized crop rectangle, and a
  monotonically increasing `revision`.
- Unit localization rows continue to reference only the ImageAsset identity.
  Attachment validation requires a ready presentation for the referenced role.

Avatar and banner use the same fixed-crop strategy. Avatar is 1:1, defaults to
a centered crop, and receives its circle only as a rendering mask. Banner is
4:1 and defaults to a top-left crop. Cover defaults to `contain`, preserving the
complete source in the 3:4 Cover component with its blurred backdrop; authors
may explicitly choose a 3:4 crop.

Crop coordinates are fractions of the auto-oriented original rather than
provider-specific transformation strings. The delivery boundary converts the
rectangle into top/right/bottom/left pixel trim, then resizes and negotiates
AVIF or WebP when accepted, with PNG/JPEG fallback. Derived objects use a key
containing role, presentation revision, output size, and format, and are stored
with immutable cache metadata. The stable presentation route has a short edge
cache lifetime and varies by `Accept`; mutation responses append the revision
as a cache-busting query.

PostgreSQL enforces row-local invariants: only Cover may use `contain`, crop
coordinates must be complete and bounded, and revisions must be positive.
Effective pixel aspect ratio depends on `image_object` dimensions, so the
ImageAsset service validates it against the immutable ready-object dimensions
before each presentation write rather than placing a cross-table assumption in
a `CHECK` constraint.

## Changing provider or version

Provider support is centralized in `@rezics/avatar`, the database constraints,
the API schemas, and `IdentityAvatar`. To change Font Awesome versions, update
the shared version constant and Kit together, then regenerate and verify the
OpenAPI clients. To replace the provider, migrate icon rows by their stored
`provider`, `prefix`, and `name`, then change the shared contract and renderer;
image and emoji rows are unaffected.

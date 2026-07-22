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

Images continue to use managed image assets. Only the image variant owns an
asset foreign key. Replacing an avatar with emoji or icon clears that foreign
key and every other inactive payload column.

## Changing provider or version

Provider support is centralized in `@rezics/avatar`, the database constraints,
the API schemas, and `IdentityAvatar`. To change Font Awesome versions, update
the shared version constant and Kit together, then regenerate and verify the
OpenAPI clients. To replace the provider, migrate icon rows by their stored
`provider`, `prefix`, and `name`, then change the shared contract and renderer;
image and emoji rows are unaffected.

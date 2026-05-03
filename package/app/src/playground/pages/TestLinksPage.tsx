import { SafeLink } from "@rezics/ui";

export default function TestLinksPage() {
  return (
    <div className="mx-auto w-full max-w-sm py-8">
      <h2 className="text-2xl font-semibold mb-2">
        Link Classification Smoke Test
      </h2>

      <p className="text-sm font-medium mt-6 mb-2">
        App Route (in-router navigation)
      </p>
      <SafeLink href="/shelf">Go to Shelf</SafeLink>

      <p className="text-sm font-medium mt-6 mb-2">
        Rezics Domain (regular navigation, no modal)
      </p>
      <SafeLink href="https://rezics.com/about">rezics.com/about</SafeLink>

      <p className="text-sm font-medium mt-6 mb-2">
        External Link (opens modal)
      </p>
      <SafeLink href="https://example.com/article">
        example.com article
      </SafeLink>

      <p className="text-sm font-medium mt-6 mb-2">
        Blocked Scheme (renders as plain text)
      </p>
      <SafeLink href="javascript:alert(1)">This should be plain text</SafeLink>

      <p className="text-sm font-medium mt-6 mb-2">
        External with path and params
      </p>
      <SafeLink href="https://github.com/user/repo?tab=readme#section">
        GitHub link with query and hash
      </SafeLink>
    </div>
  );
}

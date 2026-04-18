import { Container, Typography } from "@mui/material";
import { SafeLink } from "@rezics/ui";

export default function TestLinksPage() {
  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h5" gutterBottom>
        Link Classification Smoke Test
      </Typography>

      <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
        App Route (in-router navigation)
      </Typography>
      <SafeLink href="/shelf">Go to Shelf</SafeLink>

      <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
        Rezics Domain (regular navigation, no modal)
      </Typography>
      <SafeLink href="https://rezics.com/about">rezics.com/about</SafeLink>

      <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
        External Link (opens modal)
      </Typography>
      <SafeLink href="https://example.com/article">
        example.com article
      </SafeLink>

      <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
        Blocked Scheme (renders as plain text)
      </Typography>
      <SafeLink href="javascript:alert(1)">This should be plain text</SafeLink>

      <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
        External with path and params
      </Typography>
      <SafeLink href="https://github.com/user/repo?tab=readme#section">
        GitHub link with query and hash
      </SafeLink>
    </Container>
  );
}

import GitHubIcon from "@mui/icons-material/GitHub";
import TelegramIcon from "@mui/icons-material/Telegram";
import {
  Box,
  Button,
  Container,
  Divider,
  IconButton,
  Link as MUILink,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { LazyLoadImage } from "@rezics/ui/primitive/image/LazyLoadImage.tsx";
import type React from "react";
import { useTranslation } from "react-i18next";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="subtitle1"
      fontWeight={700}
      color="text.primary"
      gutterBottom
    >
      {children}
    </Typography>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <MUILink
      href={href}
      underline="hover"
      color="text.secondary"
      sx={{ lineHeight: 1.9, display: "inline-block" }}
    >
      {children}
    </MUILink>
  );
}

export function MainLayoutFooter({ className }: { className?: string }) {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <Box
      className={className}
      component="footer"
      sx={{ bgcolor: "background.paper", color: "text.primary" }}
    >
      <Divider sx={{ borderColor: "divider" }} />

      <Container maxWidth="xl" className="mx-auto px-4">
        {/* Top content */}
        <Box className="py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            {/* Brand / Intro */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mt-2">
                <LazyLoadImage
                  src="/logo.svg"
                  alt="logo"
                  className="w-11 h-8"
                />
                <Typography
                  variant="h6"
                  fontWeight={800}
                  sx={{ letterSpacing: 0.2 }}
                >
                  Library.Book
                </Typography>
              </div>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 1.5 }}
              >
                {t("layout.footer.brand.description")}
                <br />
                {t("layout.footer.brand.slogan")}
              </Typography>

              <Stack
                direction="row"
                spacing={1}
                sx={{ mt: 2 }}
                aria-label={t("layout.footer.social.aria")}
              >
                <Tooltip title={t("layout.footer.social.github")}>
                  <IconButton
                    aria-label={t("layout.footer.social.github")}
                    color="primary"
                    size="small"
                    href="https://github.com/REZICS"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <GitHubIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t("layout.footer.social.telegram")}>
                  <IconButton
                    aria-label={t("layout.footer.social.telegram")}
                    color="primary"
                    size="small"
                    href="https://t.me/REZICSofficial"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <TelegramIcon fontSize="small" />
                  </IconButton>
                </Tooltip>

                {/* <Tooltip title="暂无账号">
                  <IconButton
                    aria-label="Twitter"
                    color="primary"
                    size="small"
                    href="#"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <TwitterIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="暂无账号">
                  <IconButton
                    aria-label="LinkedIn"
                    color="primary"
                    size="small"
                    href="#"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <LinkedInIcon fontSize="small" />
                  </IconButton>
                </Tooltip> */}
              </Stack>
            </div>

            {/* Navigation */}
            <nav
              aria-label={t("layout.footer.product.aria")}
              className="md:col-span-1"
            >
              <SectionTitle>{t("layout.footer.product.title")}</SectionTitle>
              <Stack spacing={0.5}>
                <FooterLink href="/book">
                  {t("layout.footer.product.discover")}
                </FooterLink>
                <FooterLink href="/shelf">
                  {t("layout.footer.product.shelves")}
                </FooterLink>
                <FooterLink href="/review">
                  {t("layout.footer.product.reviews")}
                </FooterLink>
                <FooterLink href="/unit">
                  {t("layout.footer.product.search")}
                </FooterLink>
              </Stack>
            </nav>

            <nav
              aria-label={t("layout.footer.resources.aria")}
              className="md:col-span-1"
            >
              <SectionTitle>{t("layout.footer.resources.title")}</SectionTitle>
              <Stack spacing={0.5}>
                <FooterLink href="/docs">
                  {t("layout.footer.resources.docs")}
                </FooterLink>
                <FooterLink href="/api">
                  {t("layout.footer.resources.api")}
                </FooterLink>
                <FooterLink href="/changelog">
                  {t("layout.footer.resources.changelog")}
                </FooterLink>
                <FooterLink href="/status">
                  {t("layout.footer.resources.status")}
                </FooterLink>
              </Stack>
            </nav>

            {/* Newsletter */}
            <div className="md:col-span-1">
              <SectionTitle>{t("layout.footer.newsletter.title")}</SectionTitle>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 1.5 }}
              >
                {t("layout.footer.newsletter.description")}
              </Typography>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                component="form"
                onSubmit={(e) => e.preventDefault()}
              >
                <TextField
                  size="small"
                  type="email"
                  placeholder={t("layout.footer.newsletter.email_placeholder")}
                  fullWidth
                  aria-label={t("layout.footer.newsletter.email_aria")}
                />
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disableElevation
                  disabled
                >
                  {t("layout.footer.newsletter.submit")}
                </Button>
              </Stack>
            </div>
          </div>
        </Box>

        <Divider sx={{ borderColor: "divider" }} />

        {/* Bottom bar */}
        <Box
          className="py-6"
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            rowGap: 1.5,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {t("layout.footer.copyright", { year })}
          </Typography>

          <Stack direction="row" spacing={2} alignItems="center">
            <MUILink
              href="/privacy"
              color="text.secondary"
              underline="hover"
              variant="caption"
            >
              {t("layout.footer.legal.privacy")}
            </MUILink>
            <MUILink
              href="/terms"
              color="text.secondary"
              underline="hover"
              variant="caption"
            >
              {t("layout.footer.legal.terms")}
            </MUILink>
            <MUILink
              href="/contact"
              color="text.secondary"
              underline="hover"
              variant="caption"
            >
              {t("layout.footer.legal.contact")}
            </MUILink>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}

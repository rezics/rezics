import { useTranslation } from "@rezics/i18n/react";
import { GithubIcon, TelegramIcon } from "@rezics/icons";
import { LazyLoadImage } from "@rezics/ui/primitive/image/LazyLoadImage.tsx";
import {
  Button,
  Input,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import type React from "react";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-base font-bold text-text-primary mb-2">{children}</p>
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
    <a
      href={href}
      className="text-text-secondary hover:underline leading-[1.9] inline-block"
    >
      {children}
    </a>
  );
}

export function MainLayoutFooter({ className }: { className?: string }) {
  const { t } = useTranslation(["common", "shell"]);
  const year = new Date().getFullYear();

  return (
    <footer
      className={`bg-surface-canvas text-text-primary ${className ?? ""}`}
    >
      <Separator />

      <div className="mx-auto w-full max-w-screen-xl px-4">
        {/* Top content */}
        <div className="py-24">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-16">
            {/* Brand / Intro */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mt-2">
                <LazyLoadImage
                  src="/logo.svg"
                  alt={t("common:logo_alt")}
                  className="w-11 h-12"
                />
                <h6 className="text-base font-extrabold tracking-[0.2px] m-0">
                  REZICS
                </h6>
              </div>
              <p className="text-sm text-text-secondary mt-3">
                {t("shell:layout_footer_brand_description")}
                <br />
                {t("shell:layout_footer_brand_slogan")}
              </p>

              <TooltipProvider>
                <div className="flex flex-row gap-2 mt-4">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("shell:layout_footer_social_github")}
                          className="text-text-brand"
                          render={
                            <a
                              href="https://github.com/REZICS"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <GithubIcon className="w-4 h-4" />
                            </a>
                          }
                        />
                      }
                    />
                    <TooltipContent>
                      {t("shell:layout_footer_social_github")}
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("shell:layout_footer_social_telegram")}
                          className="text-text-brand"
                          render={
                            <a
                              href="https://t.me/REZICSofficial"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <TelegramIcon className="w-4 h-4" />
                            </a>
                          }
                        />
                      }
                    />
                    <TooltipContent>
                      {t("shell:layout_footer_social_telegram")}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </div>

            {/* Navigation */}
            <nav
              aria-label={t("shell:layout_footer_product_aria")}
              className="md:col-span-1"
            >
              <SectionTitle>
                {t("shell:layout_footer_product_title")}
              </SectionTitle>
              <div className="flex flex-col gap-1">
                <FooterLink href="/book">
                  {t("shell:layout_footer_product_discover")}
                </FooterLink>
                <FooterLink href="/shelf">
                  {t("shell:layout_footer_product_shelves")}
                </FooterLink>
                <FooterLink href="/review">
                  {t("shell:layout_footer_product_reviews")}
                </FooterLink>
                <FooterLink href="/unit">
                  {t("shell:layout_footer_product_search")}
                </FooterLink>
              </div>
            </nav>

            <nav
              aria-label={t("shell:layout_footer_resources_aria")}
              className="md:col-span-1"
            >
              <SectionTitle>
                {t("shell:layout_footer_resources_title")}
              </SectionTitle>
              <div className="flex flex-col gap-1">
                <FooterLink href="/docs">
                  {t("shell:layout_footer_resources_docs")}
                </FooterLink>
                <FooterLink href="/api">
                  {t("shell:layout_footer_resources_api")}
                </FooterLink>
                <FooterLink href="/changelog">
                  {t("shell:layout_footer_resources_changelog")}
                </FooterLink>
              </div>
            </nav>

            {/* Newsletter */}
            <div className="md:col-span-1">
              <SectionTitle>
                {t("shell:layout_footer_newsletter_title")}
              </SectionTitle>
              <p className="text-sm text-text-secondary mb-3">
                {t("shell:layout_footer_newsletter_description")}
              </p>
              <form
                className="flex flex-col sm:flex-row gap-2"
                onSubmit={(e) => e.preventDefault()}
              >
                <Input
                  type="email"
                  placeholder={t(
                    "shell:layout_footer_newsletter_email_placeholder",
                  )}
                  aria-label={t("shell:layout_footer_newsletter_email_aria")}
                  className="h-9"
                />
                <Button type="submit" disabled>
                  {t("shell:layout_footer_newsletter_submit")}
                </Button>
              </form>
            </div>
          </div>
        </div>

        <Separator />

        {/* Bottom bar */}
        <div className="py-8 flex items-center justify-between flex-wrap gap-y-3">
          <p className="text-xs text-text-secondary m-0">
            {t("shell:layout_footer_copyright", { year })}
          </p>

          <div className="flex flex-row items-center gap-4">
            <a
              href="/privacy"
              className="text-xs text-text-secondary hover:underline"
            >
              {t("shell:layout_footer_legal_privacy")}
            </a>
            <a
              href="/terms"
              className="text-xs text-text-secondary hover:underline"
            >
              {t("shell:layout_footer_legal_terms")}
            </a>
            <a
              href="/contact"
              className="text-xs text-text-secondary hover:underline"
            >
              {t("shell:layout_footer_legal_contact")}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

import {
  Button,
  Input,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { LazyLoadImage } from "@rezics/ui/primitive/image/LazyLoadImage.tsx";
import { GithubIcon, TelegramIcon } from "@rezics/icons";
import type React from "react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
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
                  alt="logo"
                  className="w-11 h-12"
                />
                <h6 className="text-base font-extrabold tracking-[0.2px] m-0">
                  REZICS
                </h6>
              </div>
              <p className="text-sm text-text-secondary mt-3">
                {t("layout.footer.brand.description")}
                <br />
                {t("layout.footer.brand.slogan")}
              </p>

              <TooltipProvider>
                <div
                  className="flex flex-row gap-2 mt-4"
                  aria-label={t("layout.footer.social.aria")}
                >
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("layout.footer.social.github")}
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
                      {t("layout.footer.social.github")}
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("layout.footer.social.telegram")}
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
                      {t("layout.footer.social.telegram")}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </div>

            {/* Navigation */}
            <nav
              aria-label={t("layout.footer.product.aria")}
              className="md:col-span-1"
            >
              <SectionTitle>{t("layout.footer.product.title")}</SectionTitle>
              <div className="flex flex-col gap-1">
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
              </div>
            </nav>

            <nav
              aria-label={t("layout.footer.resources.aria")}
              className="md:col-span-1"
            >
              <SectionTitle>{t("layout.footer.resources.title")}</SectionTitle>
              <div className="flex flex-col gap-1">
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
              </div>
            </nav>

            {/* Newsletter */}
            <div className="md:col-span-1">
              <SectionTitle>{t("layout.footer.newsletter.title")}</SectionTitle>
              <p className="text-sm text-text-secondary mb-3">
                {t("layout.footer.newsletter.description")}
              </p>
              <form
                className="flex flex-col sm:flex-row gap-2"
                onSubmit={(e) => e.preventDefault()}
              >
                <Input
                  type="email"
                  placeholder={t("layout.footer.newsletter.email_placeholder")}
                  aria-label={t("layout.footer.newsletter.email_aria")}
                  className="h-9"
                />
                <Button type="submit" disabled>
                  {t("layout.footer.newsletter.submit")}
                </Button>
              </form>
            </div>
          </div>
        </div>

        <Separator />

        {/* Bottom bar */}
        <div className="py-8 flex items-center justify-between flex-wrap gap-y-3">
          <p className="text-xs text-text-secondary m-0">
            {t("layout.footer.copyright", { year })}
          </p>

          <div className="flex flex-row items-center gap-4">
            <a
              href="/privacy"
              className="text-xs text-text-secondary hover:underline"
            >
              {t("layout.footer.legal.privacy")}
            </a>
            <a
              href="/terms"
              className="text-xs text-text-secondary hover:underline"
            >
              {t("layout.footer.legal.terms")}
            </a>
            <a
              href="/contact"
              className="text-xs text-text-secondary hover:underline"
            >
              {t("layout.footer.legal.contact")}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

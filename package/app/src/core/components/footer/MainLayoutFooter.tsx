import { useTranslation } from "@rezics/i18n/react";
import { GithubIcon, TelegramIcon } from "@rezics/icons";
import { SafeLink } from "@rezics/ui";
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
import { Link } from "@/shared/ui/link";
import { officialZoneHref } from "@/zone";

/**
 * Site-wide footer rendered by the main shell layout below all page content.
 * 全站页脚，由主 shell 布局渲染于所有页面内容下方。
 *
 * Structure / 结构:
 *   Separator → top grid (brand + 2 nav columns + newsletter) → Separator → bottom bar
 *
 * The outer container mirrors `MainContentContainer width="wide"`: `max-w-screen-xl`
 * centered with `px-4`. / 外层容器与 `MainContentContainer width="wide"` 保持一致：
 * `max-w-screen-xl` 居中，`px-4` 内边距。
 *
 * ---
 *
 * Mobile (<768 px) — single column stack / 移动端：单列堆叠
 * ```
 * |<-------- 100vw -------->|
 * | ======================== |  <- Separator
 * | px-4                     |
 * |  [Brand + social icons]  |
 * |  [Product nav]           |
 * |  [Resources nav]         |
 * |  [Newsletter form]       |  <- col + col stacked
 * | ======================== |  <- Separator
 * |  [copyright] [legal links]|  <- flex-wrap, stacked if narrow
 * ```
 *
 * Tablet (768 px – 1023 px) — 4-column grid, newsletter form is row / 平板：4 列网格，订阅表单横排
 * ```
 * |<-------------- vw -------------->|
 * | ================================= |  <- Separator
 * | px-4                              |
 * |  [Brand]  [Product]  [Resources]  [Newsletter   ]  |
 * |           [nav    ]  [nav      ]  [email] [submit]  |
 * | ================================= |  <- Separator
 * |  [copyright]        [privacy] [terms] [contact]  |
 * ```
 *
 * Desktop (1024 px – 1535 px) — same 4-column grid, more horizontal space / 桌面：同 4 列网格，水平空间更宽
 * ```
 * |<----------------- vw ----------------->|
 * | ======================================= |  <- Separator
 * | px-4                                    |
 * |  [Brand+social] [Product] [Res] [News]  |
 * | ======================================= |  <- Separator
 * |  [copyright]       [privacy] [terms] [contact]  |
 * ```
 *
 * Ultra-wide (≥1280 px) — capped at 1280 px, centered / 超宽屏：固定 1280 px，居中
 * ```
 * |<----------------- vw ---------------------->|
 * |  auto  |<-------- 1280px -------->|  auto   |
 *          | ========================= |  <- Separator
 *          | px-4                      |
 *          |  [Brand] [Prod] [Res] [News]  |
 *          | ========================= |  <- Separator
 *          |  [copyright]  [legal links]   |
 * ```
 */
export function MainLayoutFooter({ className }: { className?: string }) {
  const { t } = useTranslation(["common", "shell"]);
  const year = new Date().getFullYear();

  return (
    <footer
      className={`bg-surface-canvas text-text-primary ${className ?? ""}`}
    >
      <Separator />

      <div className="mx-auto w-full max-w-screen-xl px-4">
        {/* Top content 顶部内容 */}
        <div className="py-24">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-16">
            {/* Brand / Intro 品牌 / 简介 */}
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
                          className="text-link"
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
                          className="text-link"
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

            {/* Navigation 导航 */}
            <nav
              aria-label={t("shell:layout_footer_product_aria")}
              className="md:col-span-1"
            >
              <SectionTitle>
                {t("shell:layout_footer_product_title")}
              </SectionTitle>
              <div className="flex flex-col gap-1">
                <FooterLink href={officialZoneHref("book")}>
                  {t("shell:layout_footer_product_books")}
                </FooterLink>
                <FooterLink href={officialZoneHref("realms")}>
                  {t("shell:layout_footer_product_realms")}
                </FooterLink>
                <FooterLink href={officialZoneHref("zones")}>
                  {t("shell:layout_footer_product_zones")}
                </FooterLink>
                <FooterLink href={officialZoneHref("popular")}>
                  {t("shell:layout_footer_product_popular")}
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

            {/* Newsletter 邮件订阅 */}
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

        {/* Bottom bar 底部栏 */}
        <div className="py-8 flex items-center justify-between flex-wrap gap-y-3">
          <p className="text-xs text-text-secondary m-0">
            {t("shell:layout_footer_copyright", { year })}
          </p>

          <div className="flex flex-row items-center gap-4 pr-20">
            <SafeLink
              href="/privacy"
              className="text-xs text-text-secondary hover:underline"
            >
              {t("shell:layout_footer_legal_privacy")}
            </SafeLink>
            <SafeLink
              href="/terms"
              className="text-xs text-text-secondary hover:underline"
            >
              {t("shell:layout_footer_legal_terms")}
            </SafeLink>
            <SafeLink
              href="/contact"
              className="text-xs text-text-secondary hover:underline"
            >
              {t("shell:layout_footer_legal_contact")}
            </SafeLink>
          </div>
        </div>
      </div>
    </footer>
  );
}

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
    <Link
      to={href}
      className="text-text-secondary hover:underline leading-[1.9] inline-block"
    >
      {children}
    </Link>
  );
}

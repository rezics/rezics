import type { ZoneHeroSection } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { buttonVariants } from "@rezics/ui/shadcn";
import { AppSafeLink as SafeLink } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";
import {
  zoneCreateHref,
  zoneJoinHref,
  zoneLinkFallbackKey,
  zoneLinkHref,
  zoneLinkLabel,
} from "../../models/zoneMenu";
import { useZoneLabelResolver, type ZonePortalContext } from "./shared";

/**
 * Hero owns no text: it renders the zone unit's own translations
 * (`zone.name`/`zone.description`). Decorative images are HTTPS URLs; missing
 * banner/logo render nothing rather than placeholders.
 * hero 不拥有文本：它渲染专区 Unit 自身的译文（`zone.name`/
 * `zone.description`）。图片 Unit 可能尚无已解析的 URL；缺失的横幅/
 * 标识直接不渲染而非占位。
 *
 * Layout responsive design with layered background images and button wrapping:
 * - Mobile (<640px): Single column layout, px-6 py-12, buttons wrap vertically
 * - Tablet (640-1023px): Same padding, buttons flow inline with wrapping
 * - Desktop (1024-1535px): px-12 py-16 padding, buttons inline with gap-3
 * - Ultra-wide (≥1536px): Same as desktop with rounded-lg container
 *
 * Mobile (<640px):
 * ┌─────────────────────────────────┐
 * │ [rounded-lg container]          │
 * │ ┌───────────────────────────┐   │
 * │ │ [Banner image (opacity)]  │   │
 * │ └───────────────────────────┘   │
 * │ [Logo 16x16]                    │
 * │                                 │
 * │ Zone Name (text-3xl bold)       │
 * │                                 │
 * │ Description text that wraps     │
 * │ across multiple lines on        │
 * │ mobile screens and displays     │
 * │ the zone's purpose...           │
 * │                                 │
 * │ [Join Realm Button (sm)]        │ (primary)
 * │ [Custom CTA 1 (sm, outline)]    │
 * │ [Custom CTA 2 (sm, outline)]    │
 * │ [Create Wiki Button (sm, ghost)]│
 * │ [Create Post Button (sm, ghost)]│
 * │                                 │
 * └─────────────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌──────────────────────────────────┐
 * │ [rounded-lg container]           │
 * │ [Banner bg image]                │
 * │ ┌────────────────────────────┐   │
 * │ │ [Logo 16x16]               │   │
 * │ │                            │   │
 * │ │ Zone Name (text-3xl bold)  │   │
 * │ │                            │   │
 * │ │ Description that spans up  │   │
 * │ │ to max-w-2xl, readable...  │   │
 * │ │                            │   │
 * │ │ [Join] [CTA1] [CTA2]       │   │
 * │ │ [Wiki] [Post]              │   │ (flex wrap gap-3)
 * │ └────────────────────────────┘   │
 * └──────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌──────────────────────────────────────────────┐
 * │ [rounded-lg bg-surface-subtle]               │
 * │ [Banner image overlay (opacity-30)]          │
 * │ ┌──────────────────────────────────────────┐ │
 * │ │ [Logo 16x16 rounded-md]                  │ │
 * │ │                                          │ │
 * │ │ Zone Name (text-3xl font-semibold)       │ │
 * │ │                                          │ │
 * │ │ Description (max-w-2xl, text-base)       │ │
 * │ │ Fully rendered with wrapping support     │ │
 * │ │ for longer zone descriptions...          │ │
 * │ │                                          │ │
 * │ │ [Join Realm] [CTA1] [CTA2]               │ │
 * │ │ [Create Wiki] [Create Post]              │ │ (flex gap-3)
 * │ └──────────────────────────────────────────┘ │
 * └──────────────────────────────────────────────┘
 *
 * Ultra-wide (≥1536px):
 * ┌────────────────────────────────────────────────────────┐
 * │ [Extra padding]                                        │
 * │ ┌──────────────────────────────────────────────────┐   │
 * │ │ [rounded-lg with theme surface background]       │   │
 * │ │                                                  │   │
 * │ │ [Banner image with opacity overlay]              │   │
 * │ │ ┌────────────────────────────────────────────┐   │   │
 * │ │ │ [Logo 16x16]                              │   │   │
 * │ │ │                                            │   │   │
 * │ │ │ Zone Name (large responsive heading)       │   │   │
 * │ │ │                                            │   │   │
 * │ │ │ Description (max-w-2xl for readability)   │   │   │
 * │ │ │ Full text with proper line-height...      │   │   │
 * │ │ │                                            │   │   │
 * │ │ │ [Join Realm] [CTA1] [CTA2]                │   │   │
 * │ │ │ [Create Wiki] [Create Post]               │   │   │
 * │ │ └────────────────────────────────────────────┘   │   │
 * │ └──────────────────────────────────────────────────┘   │
 * │ [Extra padding]                                        │
 * └────────────────────────────────────────────────────────┘
 */
export function HeroSection({
  section,
  ctx,
}: {
  section: ZoneHeroSection;
  ctx: ZonePortalContext;
}) {
  const { t } = useTranslation(["zone"]);
  const { zone, refUnits } = ctx;
  const images = zone.theme.images;
  const bannerUrl = section.bannerImageUrl ?? images?.bannerUrl ?? null;
  const logoUrl = section.logoImageUrl ?? images?.logoUrl ?? null;

  const resolveLabel = useZoneLabelResolver();
  const linkCtx = { zoneSlug: zone.slug, pages: zone.pages, refUnits };
  const ctas = (section.ctas ?? []).flatMap((item, index) => {
    const href = zoneLinkHref(item.target, linkCtx);
    const label = resolveLabel(
      zoneLinkLabel(item, refUnits),
      zoneLinkFallbackKey(item.target),
    );
    if (!href || !label) return [];
    return [{ key: `${section.id}:cta:${index}`, href, label }];
  });
  const joinHref = zoneJoinHref(zone.boundary, refUnits);
  const createWikiHref = zoneCreateHref(zone.boundary, refUnits, "wiki");
  const createPostHref = zoneCreateHref(zone.boundary, refUnits, "post");

  return (
    <section
      className="relative isolate overflow-hidden rounded-lg bg-surface-subtle"
      // Zone theme surface token, injected at the portal root; falls back
      // to the class background when the zone defines no theme.
      // 专区主题 surface token，于门户根节点注入；专区未定义主题时回退
      // 到 class 背景。
      style={{ backgroundColor: "var(--zone-color-surface)" }}
    >
      {bannerUrl ? (
        <img
          src={bannerUrl}
          alt=""
          className="absolute inset-0 -z-10 h-full w-full object-cover opacity-30"
        />
      ) : null}
      <div className="flex flex-col items-start gap-4 px-6 py-12 md:px-12 md:py-16">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            className="h-16 w-16 rounded-md object-cover"
          />
        ) : null}
        <h1 className="text-3xl font-semibold leading-ui text-text-primary">
          {zone.name}
        </h1>
        {section.showDescription !== false && zone.description ? (
          <p className="max-w-2xl text-base leading-body text-text-secondary">
            {zone.description}
          </p>
        ) : null}
        {ctas.length > 0 || joinHref || createWikiHref ? (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {joinHref ? (
              <SafeLink
                href={joinHref}
                className={cn(buttonVariants({ size: "sm" }))}
              >
                {t("zone:join_realm")}
              </SafeLink>
            ) : null}
            {ctas.map((cta) => (
              <SafeLink
                key={cta.key}
                href={cta.href}
                className={cn(
                  buttonVariants({ size: "sm", variant: "outline" }),
                )}
              >
                {cta.label}
              </SafeLink>
            ))}
            {createWikiHref ? (
              <SafeLink
                href={createWikiHref}
                className={cn(buttonVariants({ size: "sm", variant: "ghost" }))}
              >
                {t("zone:create_wiki")}
              </SafeLink>
            ) : null}
            {createPostHref ? (
              <SafeLink
                href={createPostHref}
                className={cn(buttonVariants({ size: "sm", variant: "ghost" }))}
              >
                {t("zone:create_post")}
              </SafeLink>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

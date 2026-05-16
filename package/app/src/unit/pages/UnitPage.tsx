import {
  useAttachTranslation,
  useTranslationGroupSiblings,
} from "@rezics/api/translation-group";
import { unitDetailQuery } from "@rezics/api/unit/unit";
import { MarkdownContent } from "@rezics/ui/composite/content/MarkdownContent.tsx";
import { AccentBar } from "@rezics/ui/primitive/decorative/AccentBar.tsx";
import { TextLink } from "@rezics/ui/primitive/link/TextLink.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { unitRoute } from "@/router";
import { PostLanguageSwitcher } from "../components/PostLanguageSwitcher";

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) return "-";

  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch (_e) {
    return String(value);
  }
}

export function UnitPageById({ unitId }: { unitId: string }) {
  const { t } = useTranslation();

  const {
    data: unit,
    isLoading,
    error,
  } = useQuery(unitDetailQuery(unitId || ""));

  const isPost = unit?.type === "POST";
  const groupId = unit?.translationGroupId ?? null;
  const siblingsQuery = useTranslationGroupSiblings(
    isPost && groupId ? unit.id : null,
  );
  const attach = useAttachTranslation();

  if (isLoading) {
    return (
      <div className="mt-8 text-center text-sm text-gray-500">Loading...</div>
    );
  }

  if (error) {
    return <QueryErrorDisplay error={error} className="mt-8" />;
  }

  if (!unit) {
    return (
      <div className="mt-8 text-center text-sm text-gray-500">
        {t("common.no_data")}
      </div>
    );
  }

  const primaryTranslation = unit.translations?.[0];
  const title = primaryTranslation?.title;
  const content = primaryTranslation?.description;
  const metadataEntries = Object.entries(unit.extra ?? {});

  // MOCK: client-side gate until permissions are finalized for translation attach.
  const canAddTranslation = isPost;
  const handleAddTranslation = () => {
    const lang = window.prompt(
      t(
        "post.add_translation_prompt",
        "New translation language code (e.g. ja, en, zh-hant)",
      ) ?? "",
    );
    if (!lang) return;
    attach.mutate({
      unitId: unit.id,
      input: { language: lang as never, body: "" },
    });
  };

  return (
    <div className="w-11/12 max-w-4xl mx-auto mt-16 mb-16">
      {/* ANCHOR Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">
            {title || t("pages.unit_page", "Unit")}
          </h1>
          <p className="text-xs sm:text-sm break-all text-text-secondary">
            ID: {unit.id}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mt-1 sm:mt-0 justify-start sm:justify-end">
          {unit.type && <Badge variant="outline">{unit.type}</Badge>}
          {unit.status && <Badge variant="outline">{unit.status}</Badge>}
          {(unit.extra?.tags as string[] | undefined)?.map((tag: string) => (
            <Badge key={tag} variant="outline" className="rounded-full">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* ANCHOR User & basic meta */}
      {(unit.user || unit.createdAt || unit.updatedAt) && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {unit.user && (
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10 rounded-md">
                <AvatarImage src={unit.user.avatar ?? ""} />
                <AvatarFallback>
                  {unit.user.name?.charAt(0).toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger
                      render={(props) => (
                        <TextLink
                          to={unit.user.slug ? "/u/$userSlug" : "/user/$userId"}
                          params={
                            unit.user.slug
                              ? { userSlug: unit.user.slug }
                              : { unitId: unit.user.unitId }
                          }
                          className="text-sm font-medium"
                          {...props}
                        >
                          {unit.user.name}
                        </TextLink>
                      )}
                    />
                    <TooltipContent>{t("user.open_profile")}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="text-xs text-text-secondary">
                  {unit.user.slug}
                </span>
              </div>
            </div>
          )}

          <div className="text-xs space-y-0.5 sm:text-right">
            {unit.createdAt && (
              <div>
                {t("common.created_at")}: {String(unit.createdAt)}
              </div>
            )}
            {unit.updatedAt && (
              <div>
                {t("common.updated_at")}: {String(unit.updatedAt)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ANCHOR Translation switcher (POST only when grouped) */}
      {isPost && groupId && (
        <div className="mt-8">
          <PostLanguageSwitcher
            currentUnitId={unit.id}
            currentLanguage={unit.defaultLanguage ?? null}
            supportedLanguages={siblingsQuery.data?.supportedLanguages ?? []}
            siblings={siblingsQuery.data?.siblings ?? []}
            isLoading={siblingsQuery.isLoading}
            canAddTranslation={canAddTranslation}
            onAddTranslation={handleAddTranslation}
          />
        </div>
      )}

      {/* ANCHOR Content */}
      <div className="mt-12">
        <div className="bg-surface-elevated p-6 rounded-md">
          {content ? (
            <MarkdownContent content={content} />
          ) : (
            <p className="text-sm text-text-secondary">
              {t("unit.no_content")}
            </p>
          )}
        </div>
      </div>

      {/* ANCHOR Metadata */}
      <div className="mt-16">
        <div className="flex items-center gap-2 mb-4">
          <AccentBar />
          <h2 className="text-lg font-bold">{t("unit.meta_data")}</h2>
        </div>

        {metadataEntries.length === 0 ? (
          <p className="text-sm text-text-secondary">
            {t("unit.no_metadata", "暂无 Meta 信息")}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {metadataEntries.map(([key, value]) => (
              <div key={key} className="bg-surface-elevated p-4 rounded-md">
                <p className="text-sm font-semibold">{key}</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-text-secondary">
                  {formatMetadataValue(value)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function UnitPage() {
  const { unitId } = unitRoute.useParams();
  return <UnitPageById unitId={unitId || ""} />;
}

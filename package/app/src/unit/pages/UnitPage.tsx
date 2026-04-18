import { Avatar, Chip, Paper, Tooltip, Typography } from "@mui/material";
import {
  useAttachTranslation,
  useTranslationGroupSiblings,
} from "@rezics/api/translation-group";
import { unitDetailQuery } from "@rezics/api/unit/unit";
import { MarkdownContent } from "@rezics/ui/composite/content/MarkdownContent.tsx";
import { AccentBar } from "@rezics/ui/primitive/decorative/AccentBar.tsx";
import { MUILink } from "@rezics/ui/primitive/link/MUILink.tsx";
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

export function UnitPage() {
  const { unitId } = unitRoute.useParams();
  const { t } = useTranslation();

  const {
    data: unit,
    isLoading,
    error,
  } = useQuery(unitDetailQuery(unitId || ""));

  if (isLoading) {
    return (
      <div className="mt-6 text-center text-sm text-gray-500">Loading...</div>
    );
  }

  if (error) {
    return <QueryErrorDisplay error={error} className="mt-6" />;
  }

  if (!unit) {
    return (
      <div className="mt-6 text-center text-sm text-gray-500">
        {t("common.no_data")}
      </div>
    );
  }

  const primaryTranslation = unit.translations?.[0];
  const title = primaryTranslation?.title;
  const content = primaryTranslation?.description;
  const metadataEntries = Object.entries(unit.extra ?? {});

  const isPost = unit.type === "POST";
  const groupId = unit.translationGroupId ?? null;
  const siblingsQuery = useTranslationGroupSiblings(
    isPost && groupId ? unit.id : null,
  );
  const attach = useAttachTranslation();
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
    <div className="w-11/12 max-w-4xl mx-auto mt-10 mb-10">
      {/* ANCHOR Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <Typography variant="h4" className="font-bold">
            {title || t("pages.unit_page", "Unit")}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            className="text-xs sm:text-sm break-all"
          >
            ID: {unit.id}
          </Typography>
        </div>

        <div className="flex flex-wrap gap-2 mt-1 sm:mt-0 justify-start sm:justify-end">
          {unit.type && (
            <Chip
              label={unit.type}
              color="primary"
              size="small"
              variant="outlined"
            />
          )}
          {unit.status && (
            <Chip
              label={unit.status}
              size="small"
              variant="outlined"
              color="default"
            />
          )}
          {(unit.extra?.tags as string[] | undefined)?.map((tag: string) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              variant="outlined"
              sx={{ borderRadius: 999 }}
            />
          ))}
        </div>
      </div>

      {/* ANCHOR User & basic meta */}
      {(unit.user || unit.createdAt || unit.updatedAt) && (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {unit.user && (
            <div className="flex items-center gap-3">
              <Avatar
                src={unit.user.avatar ?? ""}
                sx={{ width: 40, height: 40, borderRadius: 1 }}
              />
              <div className="flex flex-col">
                <Tooltip title={t("user.open_profile")}>
                  <MUILink
                    to="/user/$unitId"
                    params={{ unitId: unit.user.unitId }}
                    className="text-sm font-medium"
                  >
                    {unit.user.name}
                  </MUILink>
                </Tooltip>
                <Typography variant="caption" color="text.secondary">
                  {unit.user.slug}
                </Typography>
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
        <div className="mt-6">
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
      <div className="mt-8">
        <Paper className="p-5">
          {content ? (
            <MarkdownContent content={content} />
          ) : (
            <Typography variant="body2" color="text.secondary">
              {t("unit.no_content")}
            </Typography>
          )}
        </Paper>
      </div>

      {/* ANCHOR Metadata */}
      <div className="mt-10">
        <div className="flex items-center gap-2 mb-4">
          <AccentBar />
          <Typography variant="h6" className="font-bold">
            {t("unit.meta_data")}
          </Typography>
        </div>

        {metadataEntries.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t("unit.no_metadata", "暂无 Meta 信息")}
          </Typography>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {metadataEntries.map(([key, value]) => (
              <Paper key={key} className="p-4">
                <Typography variant="subtitle2" className="font-semibold">
                  {key}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  className="mt-1 whitespace-pre-wrap break-words"
                >
                  {formatMetadataValue(value)}
                </Typography>
              </Paper>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

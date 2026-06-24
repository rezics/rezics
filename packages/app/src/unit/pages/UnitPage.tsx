import { unitDetailQuery } from "@rezics/contract/api/unit/unit";
import { mainMarkdownSource } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { MarkdownContent } from "@rezics/ui/composite/content/MarkdownContent.tsx";
import { AccentBar } from "@rezics/ui/primitive/decorative/AccentBar.tsx";
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
import {
  isApiNotFoundError,
  QueryErrorDisplay,
  ResourceNotFoundState,
} from "@/core";
import { Route as unitRoute } from "@/routes/_mainLayout/unit/$unitId";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { TextLink, unitHref } from "@/shared/ui/link";

/**
 * Unit detail page displaying unit metadata, markdown content, and associated
 * metadata fields. Header includes title, ID, badges, author info, and timestamps.
 * Unit 详情页面，显示 unit 元数据、Markdown 内容和关联的元数据字段。
 * 页头包括标题、ID、徽章、作者信息和时间戳。
 *
 * Mobile <640px:
 * +--[max-w-4xl]--+
 * | [Title]       |
 * | ID: xxx...    |
 * | [Badge][Badge]|
 * | +--+          |
 * | |Av| Author   |
 * | |tr| @slug    |
 * | +--+          |
 * | Created: ..   |
 * | Updated: ...  |
 * | +-Content---+ |
 * | | Markdown  | |
 * | +-----------+ |
 * | Metadata      |
 * | +-+--------+  |
 * | |k|  v     |  |
 * | +-+--------+  |
 * +---------------+
 *
 * Tablet 640-1023px:
 * +----[max-w-4xl]----+
 * | [Title] [Badges]  |
 * | ID: xxx...        |
 * | +--+ Author Info  |
 * | |Av| @slug        |
 * | |tr|              |
 * | +--+ Created: ... |
 * |     Updated: ...  |
 * | +-Content-------+ |
 * | | Markdown      | |
 * | | Content Text  | |
 * | +---------------+ |
 * | Metadata          |
 * | +-Key-+ +-Value+ |
 * | | k1  | | v1  | |
 * | +-Key-+ +-Value+ |
 * | | k2  | | v2  | |
 * | +-----+ +-----+ |
 * +------------------+
 *
 * Desktop 1024-1535px:
 * +-------[max-w-4xl]-------+
 * | [Title]    [Badges]    |
 * | ID: xxx... [Status]    |
 * | +--+ Author [Created]  |
 * | |Av| @slug  [Updated]  |
 * | |tr|                    |
 * | +--+                    |
 * | +-Content-----------+ |
 * | | Markdown Content  | |
 * | | Full Paragraph... | |
 * | +-------------------+ |
 * | Metadata              |
 * | +-Key-----+ +-Value+ |
 * | | Field 1 | |Value1| |
 * | +---------+ +-----+ |
 * | +-Key-----+ +-Value+ |
 * | | Field 2 | |Value2| |
 * | +---------+ +-----+ |
 * +------------------------+
 *
 * Ultra-wide >=1536px:
 * +-------[max-w-4xl]-------+
 * | [Title]    [Badges]    |
 * | ID: xxx... [Status]    |
 * | +--+ Author [Created]  |
 * | |Av| @slug  [Updated]  |
 * | |tr|                    |
 * | +--+                    |
 * | +-Content-----------+ |
 * | | Markdown Content  | |
 * | | Full Paragraph... | |
 * | +-------------------+ |
 * | Metadata              |
 * | +-Key-----+ +-Key--+  |
 * | | Field 1 | |Field3|  |
 * | | Value 1 | |Val 3 |  |
 * | +---------+ +------+  |
 * | +-Key-----+ +-Key--+  |
 * | | Field 2 | |Field4|  |
 * | | Value 2 | |Val 4 |  |
 * | +---------+ +------+  |
 * +------------------------+
 */
export function UnitPageById({ unitId }: { unitId: string }) {
  const { t } = useTranslation(["book", "common", "settings"]);
  const readContext = useReadLanguageContext();
  const {
    data: unit,
    isLoading,
    error,
  } = useQuery({
    ...unitDetailQuery(unitId || "", {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    enabled: readContext.ready && Boolean(unitId),
  });

  // Show loading while fetching or before query is enabled
  // 加载中或查询尚未启用时显示加载状态
  if (isLoading || !readContext.ready) {
    return (
      <div className="mt-8 text-center text-sm text-gray-500">
        {t("common:loading")}
      </div>
    );
  }

  if (error) {
    return isApiNotFoundError(error) ? (
      <ResourceNotFoundState variant="section" className="mt-8" />
    ) : (
      <QueryErrorDisplay error={error} className="mt-8" />
    );
  }

  if (!unit) {
    return <ResourceNotFoundState variant="section" className="mt-8" />;
  }

  const title = unit.title;
  const content = mainMarkdownSource(unit.description);
  const metadataEntries = Object.entries(unit.extra ?? {});
  const author = unit.user;

  return (
    <div className="w-full px-4 max-w-4xl mx-auto mt-16 mb-16">
      {/* ANCHOR Header — 头部 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">
            {title || t("book:pages_unit_page")}
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

      {/* ANCHOR User & basic meta — 用户与基本元数据 */}
      {(author || unit.createdAt || unit.updatedAt) && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {author && (
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10 rounded-md">
                <AvatarImage
                  src={author.avatar ?? ""}
                  alt={author.name ?? ""}
                />
                <AvatarFallback>
                  {author.name?.charAt(0).toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger
                      render={(props) => (
                        <TextLink
                          to={unitHref({
                            type: "USER",
                            unitId: author.unitId,
                            slug: author.slug ?? null,
                          })}
                          className="text-sm font-medium"
                          {...props}
                        >
                          {author.name}
                        </TextLink>
                      )}
                    />
                    <TooltipContent>
                      {t("settings:user_open_profile")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="text-xs text-text-secondary">
                  {author.slug}
                </span>
              </div>
            </div>
          )}

          <div className="text-xs space-y-0.5 sm:text-right">
            {unit.createdAt && (
              <div>
                {t("common:created_at")}: {String(unit.createdAt)}
              </div>
            )}
            {unit.updatedAt && (
              <div>
                {t("common:updated_at")}: {String(unit.updatedAt)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ANCHOR Content — 内容 */}
      <div className="mt-12">
        <div className="bg-surface-elevated p-6 rounded-md">
          {content ? (
            <MarkdownContent content={content} />
          ) : (
            <p className="text-sm text-text-secondary">
              {t("book:unit_no_content")}
            </p>
          )}
        </div>
      </div>

      {/* ANCHOR Metadata — 元数据 */}
      <div className="mt-16">
        <div className="flex items-center gap-2 mb-4">
          <AccentBar />
          <h2 className="text-lg font-bold">{t("book:unit_meta_data")}</h2>
        </div>

        {metadataEntries.length === 0 ? (
          <p className="text-sm text-text-secondary">
            {t("book:unit_no_metadata")}
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

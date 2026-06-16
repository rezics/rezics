import {
  myRealmMembershipQuery,
  realmDetailQuery,
} from "@rezics/api/realm/realm";
import { contentDocMarkdownFallback } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, FileText, LibraryBig, ListPlus, Vote } from "lucide-react";
import { useState } from "react";
import { QueryErrorDisplay } from "@/core";
import { WikiPostEditor } from "@/post";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { JoinButton } from "../components/JoinButton";
import { RealmExistingPostSubmitSection } from "../components/RealmExistingPostSubmitSection";
import { RealmPollWorkspace } from "../components/RealmPollWorkspace";
import { RealmPostCreateForm } from "../components/RealmPostCreateForm";
import {
  normalizeRealmCreateMode,
  type RealmCreateMode,
  realmCreateModeLabel,
  realmCreateModes,
} from "../models/realmCreateMode";
import { RuleSection } from "../sections/RuleSection";

export interface RealmCreatePageProps {
  realmId: string;
  mode?: RealmCreateMode;
  detailHref?: string;
  onModeChange?: (mode: RealmCreateMode) => void;
}

const modeIcons = {
  post: FileText,
  wiki: LibraryBig,
  poll: Vote,
  existing: ListPlus,
} satisfies Record<RealmCreateMode, typeof FileText>;

/**
 * Content creation page for a realm with tabbed mode selector (post/wiki/poll/existing).
 * Displays realm rules, member-only gate, and mode-specific editors.
 * 专区内容创建页，带标签页模式选择器（帖子/维基/投票/现有）。
 * 显示专区规则、仅成员门槛和模式特定编辑器。
 *
 * Layout responsive design:
 * - Mobile (<640px): Full-width single column, stacked breadcrumb, title, and mode tabs vertically
 * - Tablet (640-1023px): Same as mobile with slightly wider card spacing
 * - Desktop (1024-1535px): Max-width 5xl container, breadcrumb + title on left side, join button on right, mode tabs below
 * - Ultra-wide (≥1536px): Same as desktop with centered max-width container
 *
 * Mobile (<640px):
 * ┌──────────────────────────┐
 * │ < Realm Name            │ (back button)
 * ├──────────────────────────┤
 * │ Create                   │ (title)
 * │ Description of what      │ (description, if exists)
 * │ you can create here...   │
 * ├──────────────────────────┤
 * │ [Join Realm]             │ (button, if not member)
 * ├──────────────────────────┤
 * │ Rules                    │ (rule section)
 * │ Your posts must follow   │
 * │ these guidelines...      │
 * ├──────────────────────────┤
 * │ [Post] [Wiki]            │ (mode tabs, wrapping)
 * │ [Poll] [Existing]        │
 * ├──────────────────────────┤
 * │ [Mode-specific editor]   │
 * │ grows to fill space      │
 * └──────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │ < Realm Name                       │
 * ├────────────────────────────────────┤
 * │ Create                             │
 * │ Description of what you can        │
 * │ create here...                     │
 * │                      [Join Realm]  │
 * ├────────────────────────────────────┤
 * │ Rules                              │
 * │ Guidelines for posting...          │
 * ├────────────────────────────────────┤
 * │ [Post] [Wiki] [Poll] [Existing]    │
 * ├────────────────────────────────────┤
 * │ [Mode-specific content area]       │
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌──────────────────────────────────────────────────┐
 * │ < Realm Name                                     │
 * ├──────────────────────────────────────────────────┤
 * │ Create              Description text...          │
 * │                                    [Join Realm]  │
 * ├──────────────────────────────────────────────────┤
 * │ Rules & Guidelines                               │
 * │ [rule content card]                              │
 * ├──────────────────────────────────────────────────┤
 * │ [Post] [Wiki] [Poll] [Existing]                  │
 * ├──────────────────────────────────────────────────┤
 * │ [Wide mode-specific content editor/form]        │
 * │ [expands to full container width]                │
 * └──────────────────────────────────────────────────┘
 *
 * Ultra-wide (≥1536px):
 * ┌────────────────────────────────────────────────────────┐
 * │     [Padding] < Realm Name            [Padding]       │
 * ├────────────────────────────────────────────────────────┤
 * │     [Padding] Create     Description... [Join] [Pad]  │
 * ├────────────────────────────────────────────────────────┤
 * │     [Padding] Rules & Guidelines          [Padding]   │
 * ├────────────────────────────────────────────────────────┤
 * │     [Padding] [Post] [Wiki] [Poll] [Existing] [Pad]   │
 * ├────────────────────────────────────────────────────────┤
 * │     [Padding] [Wide content area]         [Padding]   │
 * └────────────────────────────────────────────────────────┘
 */
export function RealmCreatePage({
  realmId,
  mode,
  detailHref = `/realm/${realmId}`,
  onModeChange,
}: RealmCreatePageProps) {
  const { t } = useTranslation(["common", "entity"]);
  const readContext = useReadLanguageContext();
  const {
    data: realm,
    isLoading: realmLoading,
    isError: realmError,
    error: realmQueryError,
  } = useQuery({
    ...realmDetailQuery(realmId, {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    enabled: readContext.ready,
  });
  const { data: membership, isLoading: membershipLoading } = useQuery(
    myRealmMembershipQuery(realmId),
  );
  const [localMode, setLocalMode] = useState<RealmCreateMode>(
    normalizeRealmCreateMode(mode),
  );
  const activeMode = normalizeRealmCreateMode(mode ?? localMode);

  const handleModeChange = (value: string) => {
    const next = normalizeRealmCreateMode(value);
    if (onModeChange) onModeChange(next);
    else setLocalMode(next);
  };

  // Realm query failed — show error, not generic "not found"
  // Realm 查询失败 —— 显示错误而非通用的"未找到"
  if (realmError) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <QueryErrorDisplay error={realmQueryError} />
      </div>
    );
  }

  if (realmLoading || membershipLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!realm) {
    return (
      <p className="py-8 text-text-secondary">{t("entity:realm_not_found")}</p>
    );
  }

  const title = realm.title ?? t("entity:realm_untitled");
  const description = contentDocMarkdownFallback(realm.description);
  const isMember = Boolean(membership?.member);
  const postHref = (postUnitId: string) => `${detailHref}/post/${postUnitId}`;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6">
      <div className="flex flex-col gap-5">
        <div>
          <Link to={detailHref}>
            <Button variant="ghost" size="sm" className="gap-2 px-0">
              <ArrowLeft className="h-4 w-4" />
              {title}
            </Button>
          </Link>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold leading-ui text-text-primary">
              {t("common:create")}
            </h1>
            {description ? (
              <p className="mt-2 max-w-3xl text-base leading-body text-text-secondary">
                {description}
              </p>
            ) : null}
          </div>
          <JoinButton realmId={realmId} />
        </div>
      </div>

      <RuleSection
        realmUnitId={realmId}
        postUnitId={realm.extra?.rule ?? null}
      />

      {!isMember ? (
        <div className="flex flex-col gap-4 rounded-md bg-surface-subtle p-6 md:flex-row md:items-center md:justify-between">
          <p className="text-sm leading-ui text-text-secondary">
            {t("entity:realm_join_to_post")}
          </p>
          <Button type="button" disabled>
            {t("common:create")}
          </Button>
        </div>
      ) : (
        <Tabs
          value={activeMode}
          onValueChange={handleModeChange}
          className="flex flex-col gap-5"
        >
          <TabsList className="flex flex-wrap justify-start">
            {realmCreateModes.map((modeValue) => {
              const Icon = modeIcons[modeValue];
              return (
                <TabsTrigger key={modeValue} value={modeValue}>
                  <Icon className="mr-2 h-4 w-4" />
                  {realmCreateModeLabel(modeValue)}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="post">
            <RealmPostCreateForm
              realmId={realmId}
              contentRequiresApproval={realm.contentRequiresApproval}
              detailHref={detailHref}
              postHref={postHref}
            />
          </TabsContent>
          <TabsContent value="wiki">
            <WikiPostEditor realmUnitIds={[realmId]} />
          </TabsContent>
          <TabsContent value="poll">
            <RealmPollWorkspace
              onCreatePostWithPoll={() => handleModeChange("post")}
            />
          </TabsContent>
          <TabsContent value="existing">
            <RealmExistingPostSubmitSection
              realmId={realmId}
              contentRequiresApproval={realm.contentRequiresApproval}
              detailHref={detailHref}
              postHref={postHref}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

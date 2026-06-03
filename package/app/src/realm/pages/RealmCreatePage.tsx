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
import { WikiPostEditor } from "@/post";
import { getTranslation } from "@/shared/utils/translation-helpers";
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
  onModeChange?: (mode: RealmCreateMode) => void;
}

const modeIcons = {
  post: FileText,
  wiki: LibraryBig,
  poll: Vote,
  existing: ListPlus,
} satisfies Record<RealmCreateMode, typeof FileText>;

export function RealmCreatePage({
  realmId,
  mode,
  onModeChange,
}: RealmCreatePageProps) {
  const { t } = useTranslation(["common", "entity"]);
  const { data: realm, isLoading: realmLoading } = useQuery(
    realmDetailQuery(realmId),
  );
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

  const translation = getTranslation(realm.translations);
  const title = translation?.title ?? t("entity:realm_untitled");
  const description = contentDocMarkdownFallback(translation?.description);
  const isMember = Boolean(membership);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6">
      <div className="flex flex-col gap-5">
        <div>
          <Link to="/realm/$realmId" params={{ realmId }}>
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
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

export default RealmCreatePage;

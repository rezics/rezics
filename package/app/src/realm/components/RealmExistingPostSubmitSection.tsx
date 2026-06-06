import { useDrafts } from "@rezics/api/draft";
import { useCurrentUserId } from "@rezics/api/hooks/useCurrentUserId";
import {
  postListQuery,
  useSubmitPostToRealmMutation,
} from "@rezics/api/post/post";
import {
  contentDocMarkdownFallback,
  type DraftMetadata,
  type PostDTO,
  PostKind,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FileText, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { policyDenialFromError } from "@/policy";
import { buildRealmExistingPostSubmitInput } from "../models/realmCreateMode";
import { RealmPostTagPicker } from "./RealmPostTagPicker";

type ExistingSubmitCandidate = {
  unitId: string;
  title: string;
  excerpt?: string;
  source: "draft" | "published";
};

function isExistingSubmitCandidate(
  candidate: ExistingSubmitCandidate | null,
): candidate is ExistingSubmitCandidate {
  return candidate !== null;
}

export interface RealmExistingPostSubmitSectionProps {
  realmId: string;
  contentRequiresApproval?: boolean;
}

function draftCandidate(draft: DraftMetadata): ExistingSubmitCandidate | null {
  if (draft.kind !== "post" && draft.kind !== "wiki") return null;
  return {
    unitId: draft.id,
    title: draft.title,
    excerpt: draft.excerpt,
    source: "draft",
  };
}

function postCandidate(post: PostDTO): ExistingSubmitCandidate {
  return {
    unitId: post.unitId,
    title: post.title?.trim() || post.unitId,
    excerpt: contentDocMarkdownFallback(post.content).slice(0, 200),
    source: "published",
  };
}

function canSubmitPublishedPost(post: PostDTO, realmId: string) {
  return (
    post.realmUnitId !== realmId &&
    (post.kind === PostKind.POST || post.kind === PostKind.WIKI)
  );
}

export function RealmExistingPostSubmitSection({
  realmId,
  contentRequiresApproval = false,
}: RealmExistingPostSubmitSectionProps) {
  const { t } = useTranslation(["common", "entity"]);
  const navigate = useNavigate();
  const userId = useCurrentUserId();
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const draftsQuery = useDrafts({ limit: 25 });
  const postsQuery = useQuery({
    ...postListQuery(
      userId
        ? {
            authorUserId: userId,
            limit: 25,
          }
        : undefined,
    ),
    enabled: Boolean(userId),
  });
  const submitMutation = useSubmitPostToRealmMutation({
    onSuccess: (post) => {
      if (contentRequiresApproval) {
        toast.success("Submitted for review.");
        navigate({
          to: "/realm/$realmId",
          params: { realmId },
        });
        return;
      }
      toast.success("Post published to realm.");
      navigate({
        to: "/realm/$realmId/post/$postUnitId",
        params: { realmId, postUnitId: post.unitId },
      });
    },
  });
  const denial = policyDenialFromError(submitMutation.error);

  const candidates = useMemo(() => {
    const draftCandidates =
      draftsQuery.data?.drafts
        .map(draftCandidate)
        .filter(isExistingSubmitCandidate) ?? [];
    const publishedCandidates =
      postsQuery.data?.posts
        .filter((post) => canSubmitPublishedPost(post, realmId))
        .map(postCandidate) ?? [];
    const seen = new Set<string>();
    return [...draftCandidates, ...publishedCandidates].filter((candidate) => {
      if (seen.has(candidate.unitId)) return false;
      seen.add(candidate.unitId);
      return true;
    });
  }, [draftsQuery.data?.drafts, postsQuery.data?.posts, realmId]);

  const selected = candidates.find(
    (candidate) => candidate.unitId === selectedUnitId,
  );
  const isLoading = draftsQuery.isLoading || postsQuery.isLoading;

  const submit = () => {
    if (!selected) return;
    submitMutation.mutate({
      unitId: selected.unitId,
      input: buildRealmExistingPostSubmitInput({
        realmId,
        tagIds: selectedTagIds,
        source: selected.source,
      }),
    });
  };

  if (!userId) {
    return (
      <p className="text-sm leading-ui text-text-secondary">
        {t("entity:login_required")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm leading-ui text-text-secondary">
          <Spinner size="sm" />
          {t("common:loading")}
        </div>
      ) : candidates.length === 0 ? (
        <p className="text-sm leading-ui text-text-secondary">
          No eligible drafts or posts.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {candidates.map((candidate) => {
            const selected = candidate.unitId === selectedUnitId;
            return (
              <Card
                key={candidate.unitId}
                surface="plain"
                interactive
                className={selected ? "ring-1 ring-border-focus" : undefined}
              >
                <button
                  type="button"
                  className="block w-full text-left"
                  onClick={() => setSelectedUnitId(candidate.unitId)}
                >
                  <CardHeader className="gap-1 p-4">
                    <div className="flex items-center gap-2 text-xs leading-dense text-text-tertiary">
                      <FileText className="h-3.5 w-3.5" />
                      {candidate.source === "draft" ? "Draft" : "Post"}
                    </div>
                    <CardTitle className="line-clamp-2 text-base leading-ui">
                      {candidate.title}
                    </CardTitle>
                  </CardHeader>
                  {candidate.excerpt ? (
                    <CardContent className="px-4 pb-4 pt-0">
                      <p className="line-clamp-2 text-sm leading-body text-text-secondary">
                        {candidate.excerpt}
                      </p>
                    </CardContent>
                  ) : null}
                </button>
              </Card>
            );
          })}
        </div>
      )}

      {selected ? (
        <>
          <RealmPostTagPicker
            realmUnitIds={[realmId]}
            selectedTagIds={selectedTagIds}
            onSelectedTagIdsChange={setSelectedTagIds}
          />
          {denial ? (
            <p className="text-sm leading-ui text-error-text">
              {denial.message}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button
              type="button"
              className="gap-2"
              disabled={submitMutation.isPending}
              onClick={submit}
            >
              <Send className="h-4 w-4" />
              {selected.source === "draft"
                ? t("common:publish")
                : t("common:submit")}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

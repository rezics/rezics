import { unitMutations } from "@rezics/api/unit/unit.mutations";
import { userQueries } from "@rezics/api/user/user.queries";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Separator,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import React from "react";

import { Page } from "@/core/layouts/Page";
import { ArrowLeft as ArrowBackIcon, Save as SaveIcon } from "lucide-react";

export default function UnitCreatePage() {
  const navigate = useNavigate();
  const [error, setError] = React.useState<string | null>(null);

  const meQuery = useQuery(userQueries.me());
  const myUnitId = meQuery.data?.unitId ?? "";

  const [userId, setUserId] = React.useState("");
  const [type, setType] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [defaultLanguage, setDefaultLanguage] = React.useState("en");
  const [translationTitle, setTranslationTitle] = React.useState("");
  const [translationSummary, setTranslationSummary] = React.useState("");

  React.useEffect(() => {
    if (userId) return;
    if (myUnitId) setUserId(myUnitId);
  }, [myUnitId, userId]);

  const createMutation = unitMutations.useCreate({
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Create failed"),
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const translations =
      translationTitle.trim() || translationSummary.trim()
        ? [
            {
              language: defaultLanguage.trim() || "en",
              title: translationTitle.trim() || undefined,
              summary: translationSummary.trim() || undefined,
            },
          ]
        : undefined;
    const unit = await createMutation.mutateAsync({
      userId: userId.trim(),
      type: type.trim(),
      status: status.trim() || undefined,
      defaultLanguage: defaultLanguage.trim() || undefined,
      translations,
    } as any);
    await navigate({ to: `/unit/${(unit as any).id}`, replace: true });
  }

  return (
    <Page title="Create Unit" description="创建一个新 Unit（Admin）">
      <Card>
        <CardContent>
          <div className="flex flex-row items-center gap-2 mb-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/unit">
                <ArrowBackIcon className="size-4" />
                Back
              </Link>
            </Button>
            <div className="flex-1" />
          </div>

          <Separator className="my-4" />

          {error ? (
            <Alert className="mb-4">
              <AlertDescription className="text-rezics-color-danger">
                {error}
              </AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={onSubmit}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="ucpu-userId">User ID</Label>
                <Input
                  id="ucpu-userId"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  required
                />
                <p className="text-xs text-rezics-color-fg-muted">
                  后端当前实现会强制用当前登录用户覆盖该字段（后续可按需改为
                  admin 可指定）。
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ucpu-type">Type</Label>
                <Input
                  id="ucpu-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  required
                  placeholder="BOOK / POST / TAG / REALM / SHELF / ..."
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ucpu-status">Status</Label>
                <Input
                  id="ucpu-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  placeholder="DRAFT / PUBLISHED / ARCHIVED / ..."
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ucpu-lang">Default Language</Label>
                <Input
                  id="ucpu-lang"
                  value={defaultLanguage}
                  onChange={(e) => setDefaultLanguage(e.target.value)}
                  placeholder="en"
                />
                <p className="text-xs text-rezics-color-fg-muted">
                  ISO language code for the primary translation
                </p>
              </div>

              <Separator />
              <p className="text-xs font-semibold text-rezics-color-fg-muted">
                Initial Translation
              </p>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ucpu-tt">Title</Label>
                <Input
                  id="ucpu-tt"
                  value={translationTitle}
                  onChange={(e) => setTranslationTitle(e.target.value)}
                />
                <p className="text-xs text-rezics-color-fg-muted">
                  Title for the initial translation (uses default language)
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ucpu-ts">Summary</Label>
                <textarea
                  id="ucpu-ts"
                  value={translationSummary}
                  onChange={(e) => setTranslationSummary(e.target.value)}
                  rows={3}
                  className="rounded-md border border-rezics-color-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rezics-color-primary"
                />
              </div>

              <div>
                <Button type="submit" disabled={createMutation.isPending}>
                  <SaveIcon className="size-4" />
                  {createMutation.isPending ? "Creating…" : "Create"}
                </Button>
              </div>
              <p className="text-xs text-rezics-color-fg-muted">
                Tip：列表页支持翻页；创建成功会跳转到编辑页。
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </Page>
  );
}

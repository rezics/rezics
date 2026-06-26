import {
  CONTENT_LANGUAGE_SLUGS,
  type ContentLanguage,
  type CreateUnitInput,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
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
import { ArrowLeft as ArrowBackIcon, Save as SaveIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";
import { Page } from "@/admin/core/layouts/Page";
import { Link, resolveAdminHref } from "@/admin/shared/ui/link";
import {
  useCreateUnitMutation,
  useCurrentUserQuery,
} from "../hooks/useUnitAdminQueries";

function isContentLanguage(value: string): value is ContentLanguage {
  return (CONTENT_LANGUAGE_SLUGS as readonly string[]).includes(value);
}

export default function UnitCreatePage() {
  const { t } = useTranslation(["admin", "common"]);
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);

  const meQuery = useCurrentUserQuery();
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

  const createMutation = useCreateUnitMutation();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const language = defaultLanguage.trim() || "en";
    if (!isContentLanguage(language)) {
      setError(t("common:language_code_placeholder"));
      return;
    }

    const translations: CreateUnitInput["translations"] =
      translationTitle.trim() || translationSummary.trim()
        ? [
            {
              language,
              title: translationTitle.trim() || undefined,
              summary: translationSummary.trim() || undefined,
            },
          ]
        : undefined;
    const input: CreateUnitInput = {
      userId: userId.trim(),
      type: type.trim(),
      status: status.trim() || undefined,
      translations,
    };

    try {
      const unit = await createMutation.mutateAsync(input);
      router.replace(resolveAdminHref("/unit/$unitId", { unitId: unit.id }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("admin:unit_create_failed"),
      );
    }
  }

  return (
    <Page
      title={t("admin:unit_create_title")}
      description={t("admin:unit_create_description")}
    >
      <Card>
        <CardContent>
          <div className="flex flex-row items-center gap-2 mb-2">
            <Button
              variant="ghost"
              size="sm"
              render={(props) => (
                <Link to="/unit" {...props}>
                  <ArrowBackIcon className="size-4" />
                  {t("common:back")}
                </Link>
              )}
            />
            <div className="flex-1" />
          </div>

          <Separator className="my-4" />

          {error ? (
            <Alert className="mb-4">
              <AlertDescription className="text-error-text">
                {error}
              </AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={onSubmit}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="ucpu-userId">{t("admin:auth_user_id")}</Label>
                <Input
                  id="ucpu-userId"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  required
                />
                <p className="text-xs text-text-secondary">
                  {t("admin:unit_primary_user_help")}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ucpu-type">{t("common:type")}</Label>
                <Input
                  id="ucpu-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  required
                  placeholder={t("admin:unit_type_placeholder")}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ucpu-status">
                  {t("admin:auth_email_status")}
                </Label>
                <Input
                  id="ucpu-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  placeholder={t("admin:unit_status_placeholder")}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ucpu-lang">
                  {t("admin:unit_default_language")}
                </Label>
                <Input
                  id="ucpu-lang"
                  value={defaultLanguage}
                  onChange={(e) => setDefaultLanguage(e.target.value)}
                  placeholder={t("common:language_code_placeholder")}
                />
                <p className="text-xs text-text-secondary">
                  {t("admin:unit_default_language_help")}
                </p>
              </div>

              <Separator />
              <p className="text-xs font-semibold text-text-secondary">
                {t("admin:unit_initial_translation")}
              </p>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ucpu-tt">{t("common:title")}</Label>
                <Input
                  id="ucpu-tt"
                  value={translationTitle}
                  onChange={(e) => setTranslationTitle(e.target.value)}
                />
                <p className="text-xs text-text-secondary">
                  {t("admin:unit_title_help")}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ucpu-ts">{t("common:summary")}</Label>
                <textarea
                  id="ucpu-ts"
                  value={translationSummary}
                  onChange={(e) => setTranslationSummary(e.target.value)}
                  rows={3}
                  className="rounded-md border border-border-whisper bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-fill"
                />
              </div>

              <div>
                <Button type="submit" disabled={createMutation.isPending}>
                  <SaveIcon className="size-4" />
                  {createMutation.isPending
                    ? t("admin:token_creating")
                    : t("common:create")}
                </Button>
              </div>
              <p className="text-xs text-text-secondary">
                {t("admin:unit_create_tip")}
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </Page>
  );
}

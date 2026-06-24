import { useUpdateMeMutation } from "@rezics/api/user/user.mutations";
import { userQueries } from "@rezics/api/user/user.queries";
import {
  contentDocMarkdownFallback,
  markdownContentDoc,
  type UpdateUser,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Alert,
  AlertDescription,
  Button,
  Input,
  Label,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Save as SaveIcon } from "lucide-react";
import { type FC, useEffect, useState } from "react";
import { ImageUploadField } from "@/shared/ui/ImageUploadField";
import { RezicsMarkdownEditor } from "@/shared/ui/RezicsMarkdownEditor";
import { SettingsSection } from "@/user/components/SettingsSection";
import { useRequireAuth } from "@/user/pages/useAuth";

type SettingsProfileFormData = Omit<
  UpdateUser,
  "avatar" | "summary" | "description" | "name"
> & {
  avatar: string;
  summary: string;
  description: string;
  name: string;
};

/**
 * 个人资料部分：编辑用户的公开资料包括头像、显示名称、简历和详细描述。
 * 用户可以上传头像 URL、输入显示名称、编辑简短简历，以及使用富格式 Markdown 编辑器编写详细描述。
 *
 * Desktop (≥1024px):
 * ┌─────────────────────────────────────┐
 * │ Edit Profile          Success saved!│
 * │                                     │
 * │ [Avatar] Avatar URL:                │
 * │ 72x72 [https://.....................│
 * │                                     │
 * │ Display Name *                      │
 * │ [John Doe......................]    │
 * │                                     │
 * │ Username (read-only)                │
 * │ @johndoe                            │
 * │                                     │
 * │ Summary                                 │
 * │ [Short summary text..................    │
 * │                                     │
 * │ Description (Markdown)              │
 * │ [Markdown Editor..................   │
 * │                                     │
 * │ [Save] button (right-aligned)      │
 * └─────────────────────────────────────┘
 *
 * Tablet (768px-1023px):
 * ┌──────────────────────────────┐
 * │ Edit Profile      [Success]  │
 * │                              │
 * │ [Avatar] Avatar URL:         │
 * │ [https://...............]    │
 * │                              │
 * │ Display Name *               │
 * │ [John Doe..................]  │
 * │                              │
 * │ Username (read-only)         │
 * │ @johndoe                     │
 * │                              │
 * │ Summary                          │
 * │ [Short summary text............]  │
 * │                              │
 * │ Description (Markdown)       │
 * │ [Markdown Editor...]         │
 * │                              │
 * │ [Save]                       │
 * └──────────────────────────────┘
 *
 * Mobile (480px-767px):
 * ┌──────────────────┐
 * │Edit Profile      │
 * │[Success]         │
 * │                  │
 * │[Avatar]Avatar    │
 * │[https://...]     │
 * │                  │
 * │Display Name *    │
 * │[John Doe....]    │
 * │                  │
 * │Username          │
 * │@johndoe          │
 * │                  │
 * │Summary               │
 * │[summary text...]     │
 * │                  │
 * │Description       │
 * │[Markdown Edit]   │
 * │                  │
 * │[Save]            │
 * └──────────────────┘
 *
 * Small Mobile (<480px):
 * ┌──────────┐
 * │Edit      │
 * │[Success] │
 * │          │
 * │[A]Avatar │
 * │[url]     │
 * │          │
 * │Display   │
 * │[John...] │
 * │          │
 * │@johndoe  │
 * │          │
 * │Summary       │
 * │[summary]     │
 * │          │
 * │Desc      │
 * │[Markdown]│
 * │[Save]    │
 * └──────────┘
 */
export const SettingsProfileSection: FC = () => {
  const { t } = useTranslation(["common", "entity", "settings"]);
  useRequireAuth();

  const { data: user, isLoading } = useQuery(userQueries.me());
  const [formData, setFormData] = useState<SettingsProfileFormData>({
    name: "",
    avatar: "",
    summary: "",
    description: "",
  });
  const [success, setSuccess] = useState(false);

  const updateMe = useUpdateMeMutation({
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    },
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name ?? "",
        avatar: user.avatar ?? "",
        summary: user.summary ?? "",
        description: contentDocMarkdownFallback(user.description),
      });
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  const handleChange = (
    field: keyof SettingsProfileFormData,
    value: string,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = formData.name.trim();
    const trimmedSummary = formData.summary.trim();
    // Reject whitespace-only display names
    // 拒绝纯空白的显示名称
    if (!trimmedName) return;
    updateMe.mutate({
      name: trimmedName || undefined,
      avatar: formData.avatar || undefined,
      summary: trimmedSummary || undefined,
      description: markdownContentDoc(formData.description),
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <SettingsSection
        title={t("settings:profile_title")}
        description={t("settings:profile_description")}
      >
        {success && (
          <Alert className="mb-4 text-success-text">
            <AlertDescription>{t("settings:profile_updated")}</AlertDescription>
          </Alert>
        )}
        {updateMe.error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{updateMe.error.message}</AlertDescription>
          </Alert>
        )}

        <div className="mb-8">
          <ImageUploadField
            value={formData.avatar || null}
            onChange={(url) => handleChange("avatar", url ?? "")}
            label={t("entity:avatar_url")}
          />
        </div>

        <div className="space-y-6">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="display-name">
              {t("settings:profile_display_name")}
            </Label>
            <Input
              id="display-name"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              required
            />
          </div>

          {user?.slug && (
            <div>
              <p className="text-xs text-text-secondary">
                {t("common:username")}
              </p>
              <p className="text-sm mt-1">@{user.slug}</p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="summary">{t("settings:profile_summary")}</Label>
            <textarea
              id="summary"
              value={formData.summary}
              onChange={(e) => handleChange("summary", e.target.value)}
              rows={2}
              placeholder={t("settings:profile_summary_placeholder")}
              className="w-full rounded-md border border-border-whisper bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-fill"
            />
          </div>

          <div>
            <p className="text-xs text-text-secondary mb-2 block">
              {t("common:description")}
            </p>
            <RezicsMarkdownEditor
              value={formData.description ?? ""}
              onChange={(value) => handleChange("description", value)}
            />
          </div>
        </div>
      </SettingsSection>

      <div className="flex justify-end py-4">
        <Button type="submit" disabled={updateMe.isPending}>
          {updateMe.isPending ? (
            <Spinner size="sm" className="mr-2" />
          ) : (
            <SaveIcon className="w-4 h-4 mr-2" />
          )}
          {t("settings:profile_save")}
        </Button>
      </div>
    </form>
  );
};

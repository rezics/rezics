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
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Input,
  Label,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Save as SaveIcon } from "lucide-react";
import { type FC, useEffect, useState } from "react";
import { RezicsMarkdownEditor } from "@/shared/ui/RezicsMarkdownEditor";
import { SettingsSection } from "@/user/components/SettingsSection";
import { useRequireAuth } from "@/user/pages/useAuth";

type SettingsProfileFormData = Omit<
  UpdateUser,
  "avatar" | "bio" | "description" | "name"
> & {
  avatar: string;
  bio: string;
  description: string;
  name: string;
};

export const SettingsProfileSection: FC = () => {
  const { t } = useTranslation(["common", "entity", "settings"]);
useRequireAuth();

  const { data: user, isLoading } = useQuery(userQueries.me());
  const [formData, setFormData] = useState<SettingsProfileFormData>({
    name: "",
    avatar: "",
    bio: "",
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
        bio: user.bio ?? "",
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
    updateMe.mutate({
      name: formData.name || undefined,
      avatar: formData.avatar || undefined,
      bio: formData.bio || undefined,
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

        <div className="flex items-center gap-4 mb-8">
          <Avatar className="w-[72px] h-[72px] rounded-md">
            <AvatarImage
              src={formData.avatar || undefined}
              alt={formData.name ?? ""}
            />
            <AvatarFallback>
              {formData.name?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 flex flex-col gap-1.5">
            <Label htmlFor="avatar-url">{t("entity:avatar_url")}</Label>
            <Input
              id="avatar-url"
              value={formData.avatar}
              onChange={(e) => handleChange("avatar", e.target.value)}
              placeholder={t("settings:profile_avatar_placeholder")}
            />
          </div>
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
            <Label htmlFor="bio">{t("settings:profile_bio")}</Label>
            <textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => handleChange("bio", e.target.value)}
              rows={2}
              placeholder={t("settings:profile_bio_placeholder")}
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

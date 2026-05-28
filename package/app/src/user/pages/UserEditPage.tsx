import { userApi } from "@rezics/api/user/user.api";
import { userQueries } from "@rezics/api/user/user.queries";
import {
  contentDocMarkdownFallback,
  markdownContentDoc,
  type UpdateUser,
  type UserDTO,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { PasswordField } from "@rezics/ui/composite/forms/field/PasswordField.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardContent,
  Input,
  Label,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useMatch } from "@tanstack/react-router";
import { XCircle as CancelIcon, Save as SaveIcon } from "lucide-react";
import type React from "react";
import type { FC } from "react";
import { useEffect, useState } from "react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { Route as UserEditRoute } from "@/routes/_mainLayout/user/$userId/edit";
import { UserLoading } from "./UserState";

export interface UserEditPageProps {
  onCancel?: () => void;
  onSuccess?: (user: UserDTO) => void;
  userId?: string;
}

type UserEditFormData = Omit<UpdateUser, "description"> & {
  description: string;
};

/**
 * UserEditPage - 用户资料编辑页面
 * 允许用户编辑自己的个人信息
 */
export const UserEditPage: FC<UserEditPageProps> = ({
  onCancel,
  onSuccess,
  userId,
}) => {
  const { t } = useTranslation(["common", "entity", "settings"]);
const routeMatch = useMatch({ from: UserEditRoute.id, shouldThrow: false });
  const resolvedUserId = userId ?? routeMatch?.params.userId;
  const [user, setUser] = useState<UserDTO | null>(null);
  const {
    data,
    isLoading,
    error: queryError,
  } = useQuery(userQueries.detail(resolvedUserId ?? ""));
  const [error, setError] = useState<string | any | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<UserEditFormData>({
    name: "",
    avatar: "",
    bio: "",
    password: "",
    description: "",
  });

  useEffect(() => {
    if (data) {
      setUser(data);
      setFormData({
        name: data.name,
        avatar: data.avatar || "",
        bio: data.bio || "",
        password: "",
        description: contentDocMarkdownFallback(data.description),
      });
    }
    if (queryError) {
      setError(queryError);
    }
  }, [data, queryError]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);

    try {
      const updateData: UpdateUser = {
        name: formData.name,
        avatar: formData.avatar || undefined,
        bio: formData.bio || undefined,
        description: markdownContentDoc(formData.description),
      };

      // Only include password if it's not empty
      if (formData.password && formData.password.trim() !== "") {
        updateData.password = formData.password;
      }
      let updatedUser: UserDTO;
      if (!resolvedUserId) {
        updatedUser = await userApi.updateMe(updateData);
      } else {
        updatedUser = await userApi.update(resolvedUserId, updateData);
      }
      setUser(updatedUser);

      if (onSuccess) {
        onSuccess(updatedUser);
      }

      // Clear password field after successful update
      setFormData((prev) => ({ ...prev, password: "" }));
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof UserEditFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return <UserLoading />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-error-text">{t("settings:user_load_failed")}</p>
      </div>
    );
  }

  return (
    <div className="w-11/12 max-w-2xl mx-auto mt-16">
      <Card surface="contained">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="w-20 h-20 rounded-lg">
              <AvatarImage
                src={formData.avatar ?? undefined}
                alt={formData.name ?? ""}
              />
              <AvatarFallback className="rounded-lg">
                {formData.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <h4 className="text-2xl font-semibold">
              {t("settings:profile_edit_title")}
            </h4>
          </div>
          <form onSubmit={handleSubmit}>
            {error && (
              <QueryErrorDisplay
                error={
                  error instanceof Error ? error : new Error(String(error))
                }
                className="mb-4"
              />
            )}
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="user-edit-name">{t("common:nickname")}</Label>
                <Input
                  id="user-edit-name"
                  value={formData.name ?? ""}
                  onChange={(e) => handleChange("name", e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="user-edit-avatar">
                  {t("entity:avatar_url")}
                </Label>
                <Input
                  id="user-edit-avatar"
                  value={formData.avatar ?? ""}
                  onChange={(e) => handleChange("avatar", e.target.value)}
                />
                <p className="text-xs text-text-secondary">
                  {t("settings:profile_avatar_help")}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="user-edit-bio">
                  {t("settings:profile_bio")}
                </Label>
                <textarea
                  id="user-edit-bio"
                  className="flex w-full rounded-md border border-border-whisper bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus:ring-2 focus:ring-brand-fill"
                  value={formData.bio ?? ""}
                  onChange={(e) => handleChange("bio", e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-text-secondary">
                  {t("settings:profile_about_help")}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="user-edit-description">
                  {t("common:description")}
                </Label>
                <textarea
                  id="user-edit-description"
                  className="flex w-full rounded-md border border-border-whisper bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus:ring-2 focus:ring-brand-fill"
                  value={formData.description ?? ""}
                  onChange={(e) => handleChange("description", e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-text-secondary">
                  {t("settings:profile_about_help")}
                </p>
              </div>
              <PasswordField
                className="w-full"
                label="New Password (optional)"
                value={formData.password || ""}
                setValue={(value) => handleChange("password", value)}
                helperText="Leave empty to keep current password"
                required={false}
              />
              <div className="flex gap-2 justify-end mt-8">
                {onCancel && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={saving}
                  >
                    <CancelIcon className="w-4 h-4 mr-2" />
                    {t("common:cancel")}
                  </Button>
                )}
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <Spinner size="sm" />
                  ) : (
                    <>
                      <SaveIcon className="w-4 h-4 mr-2" />
                      {t("common:save")}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

import CancelIcon from "@mui/icons-material/Cancel";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  TextField,
  Typography,
} from "@mui/material";
import { userApi } from "@rezics/api/user/user.api";
import { userQueries } from "@rezics/api/user/user.queries";
import type { UpdateUser, UserDTO } from "@rezics/contract";
import { PasswordField } from "@rezics/ui/composite/form/field/PasswordField.tsx";
import { useQuery } from "@tanstack/react-query";
import { QueryErrorDisplay } from "@/core/component/QueryErrorDisplay";
import { useMatch } from "@tanstack/react-router";
import type React from "react";
import type { FC } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Route as UserEditRoute } from "@/routes/_mainLayout/user/$unitId/edit";
import { UserLoading } from "./UserState";

export interface UserEditPageProps {
  onCancel?: () => void;
  onSuccess?: (user: UserDTO) => void;
  unitId?: string;
}

/**
 * UserEditPage - 用户资料编辑页面
 * 允许用户编辑自己的个人信息
 */
export const UserEditPage: FC<UserEditPageProps> = ({
  onCancel,
  onSuccess,
  unitId,
}) => {
  const routeMatch = useMatch({ from: UserEditRoute.id, shouldThrow: false });
  const resolvedUnitId = unitId ?? routeMatch?.params.unitId;
  const { t } = useTranslation();
  const [user, setUser] = useState<UserDTO | null>(null);
  const {
    data,
    isLoading,
    error: queryError,
  } = useQuery(userQueries.detail(resolvedUnitId ?? ""));
  const [error, setError] = useState<string | any | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<UpdateUser>({
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
        description: data.description || "",
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
      };

      // Only include password if it's not empty
      if (formData.password && formData.password.trim() !== "") {
        updateData.password = formData.password;
      }
      let updatedUser: UserDTO;
      if (!resolvedUnitId) {
        updatedUser = await userApi.updateMe(updateData);
      } else {
        updatedUser = await userApi.update(resolvedUnitId, updateData);
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

  const handleChange = (field: keyof UpdateUser, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return <UserLoading />;
  }

  if (!user) {
    return (
      <Box className="flex items-center justify-center h-64">
        <Typography color="error">Failed to load user data</Typography>
      </Box>
    );
  }

  return (
    <Box className="w-11/12 max-w-2xl mx-auto mt-10">
      <Card className="shadow-lg rounded-2xl">
        <CardHeader
          avatar={
            <Avatar src={formData.avatar} variant="rounded" sx={{ width: 80, height: 80, borderRadius: 2 }}>
              {formData.name?.charAt(0).toUpperCase()}
            </Avatar>
          }
          title={
            <Typography variant="h4" className="font-semibold">
              {t("common.edit")} Profile
            </Typography>
          }
        />
        <CardContent>
          <form onSubmit={handleSubmit}>
            {error && (
              <QueryErrorDisplay
                error={error instanceof Error ? error : new Error(String(error))}
                className="mb-4"
              />
            )}
            <Box className="space-y-4">
              <TextField
                fullWidth
                label={t("common.nickname")}
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                required
                variant="outlined"
              />
              <div className="h-2" />
              <TextField
                fullWidth
                label="Avatar URL"
                value={formData.avatar}
                onChange={(e) => handleChange("avatar", e.target.value)}
                variant="outlined"
                helperText="Enter a URL for your profile picture"
              />
              <div className="h-2" />
              <TextField
                fullWidth
                label="Bio"
                value={formData.bio}
                onChange={(e) => handleChange("bio", e.target.value)}
                variant="outlined"
                multiline
                rows={4}
                helperText="Tell us about yourself"
              />
              <div className="h-2" />
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                variant="outlined"
                multiline
                rows={4}
                helperText="Tell us about yourself"
              />
              <div className="h-2" />
              <PasswordField
                className="w-full"
                label="New Password (optional)"
                value={formData.password || ""}
                setValue={(value) => handleChange("password", value)}
                variant="outlined"
                helperText="Leave empty to keep current password"
                required={false}
              />
              <div className="h-2" />
              <Box className="flex gap-2 justify-end mt-6">
                {onCancel && (
                  <Button
                    variant="outlined"
                    startIcon={<CancelIcon />}
                    onClick={onCancel}
                    disabled={saving}
                  >
                    {t("common.cancel")}
                  </Button>
                )}
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SaveIcon />}
                  disabled={saving}
                >
                  {saving ? <CircularProgress size={24} /> : t("common.save")}
                </Button>
              </Box>
            </Box>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

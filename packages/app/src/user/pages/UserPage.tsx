import type { UserDTO } from "@rezics/contract";
import { useMatch } from "@tanstack/react-router";
import type { FC } from "react";
import { useState } from "react";
import { Route as userRoute } from "@/routes/_mainLayout/user/$userId";
import { useUserProfileStore } from "@/user/states";
import { UserEditPage } from "./UserEditPage";
import { UserProfilePage } from "./UserProfilePage";

export interface UserPageProps {
  isCurrentUser?: boolean;
}

/**
 * UserPage - user page container.
 * UserPage - 用户页面容器。
 * Shows the user profile or the edit form depending on state.
 * 根据状态显示用户资料或编辑表单。
 */
export const UserPage: FC<UserPageProps> = ({ isCurrentUser = false }) => {
  const routeMatch = useMatch({
    from: userRoute.id,
    shouldThrow: false,
  });
  const routeUserId = isCurrentUser ? undefined : routeMatch?.params.userId;
  const [isEditing, setIsEditing] = useState(false);
  const currentUser = useUserProfileStore((state) => state.user);

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleEditSuccess = (_user: UserDTO) => {
    setIsEditing(false);
    // Optionally refresh the profile or show success message.
    // 可选地刷新资料或显示成功提示。
  };
  const userId = routeUserId || currentUser?.unitId;

  // If in edit mode and is current user, show edit form.
  // 处于编辑模式且为当前用户时，显示编辑表单。
  if (
    isEditing &&
    (isCurrentUser || currentUser?.permission?.role?.includes("ADMIN"))
  ) {
    return (
      <UserEditPage
        onCancel={handleCancelEdit}
        onSuccess={handleEditSuccess}
        userId={userId}
      />
    );
  }

  // Otherwise show profile.
  // 否则显示资料页。
  return (
    <UserProfilePage
      userId={userId || ""}
      isCurrentUser={isCurrentUser}
      onEditClick={handleEditClick}
    />
  );
};

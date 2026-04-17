import type { UserDTO } from "@rezics/contract";
import type { FC } from "react";
import { useMatch } from "@tanstack/react-router";
import { useState } from "react";
import { userRoute } from "@/router";
import { useUserProfileStore } from "@/user/states";
import { UserEditPage } from "./UserEditPage";
import { UserProfilePage } from "./UserProfilePage";

export interface UserPageProps {
  isCurrentUser?: boolean;
}

/**
 * UserPage - 用户页面容器
 * 根据状态显示用户资料或编辑表单
 */
export const UserPage: FC<UserPageProps> = ({ isCurrentUser = false }) => {
  const routeMatch = useMatch({
    from: userRoute.id,
    shouldThrow: false,
  });
  const unitId = isCurrentUser ? undefined : routeMatch?.params.unitId;
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
    // Optionally refresh the profile or show success message
  };
  const userId = unitId || currentUser?.unitId;

  // If in edit mode and is current user, show edit form
  if (
    isEditing &&
    (isCurrentUser || currentUser?.permission?.role?.includes("ADMIN"))
  ) {
    return (
      <UserEditPage
        onCancel={handleCancelEdit}
        onSuccess={handleEditSuccess}
        unitId={userId}
      />
    );
  }

  // Otherwise show profile
  return (
    <UserProfilePage
      unitId={userId || ""}
      isCurrentUser={isCurrentUser}
      onEditClick={handleEditClick}
    />
  );
};

export default UserPage;

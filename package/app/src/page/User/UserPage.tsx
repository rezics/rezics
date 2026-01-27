import {useState} from 'react';
import type {FC} from 'react';
import {UserProfilePage} from './UserProfilePage';
import {UserEditPage} from './UserEditPage';
import type {UserDTO} from '@package/contract';
import {useUserStore} from '@/global/userStore';
import {userRoute} from '@/router/router';

export interface UserPageProps {
  isCurrentUser?: boolean;
}

/**
 * UserPage - 用户页面容器
 * 根据状态显示用户资料或编辑表单
 */
export const UserPage: FC<UserPageProps> = ({
  isCurrentUser = false,
}) => {
  const routeMatch = userRoute.useMatch({shouldThrow: false});
  const unitId = routeMatch?.params.unitId;
  const [isEditing, setIsEditing] = useState(false);
  const currentUser = useUserStore(state => state.user);
  console.log(isCurrentUser, 'isCurrentUser');

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
    (isCurrentUser || currentUser?.permission?.role?.includes('ADMIN'))
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
      unitId={userId || ''}
      isCurrentUser={isCurrentUser}
      onEditClick={handleEditClick}
    />
  );
};

export default UserPage;

import {useState} from 'react';
import type {FC} from 'react';
import {UserProfilePage} from './UserProfilePage';
import {UserEditPage} from './UserEditPage';
import type {UserDTO} from '@package/contract';

export interface UserPageProps {
  unitId?: string;
  isCurrentUser?: boolean;
}

/**
 * UserPage - 用户页面容器
 * 根据状态显示用户资料或编辑表单
 */
export const UserPage: FC<UserPageProps> = ({
  unitId,
  isCurrentUser = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);

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

  // If in edit mode and is current user, show edit form
  if (isEditing && isCurrentUser) {
    return (
      <UserEditPage onCancel={handleCancelEdit} onSuccess={handleEditSuccess} />
    );
  }

  // Otherwise show profile
  return (
    <UserProfilePage
      unitId={unitId || ''}
      isCurrentUser={isCurrentUser}
      onEditClick={handleEditClick}
    />
  );
};

export default UserPage;

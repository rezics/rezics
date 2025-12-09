// AuthorInfo.tsx  —— ES Module 版本（无 namespace）
import {AccentBarWithTextContainer} from '@/component/Common/Navigation/AccentBar.tsx';
import {ArrowForwardIconContainer} from '@/component/Common/Navigation/ArrowForwardIcon.tsx';
import EasyEditor from '@component/Form/EasyEditor.tsx';
import {Button, Typography} from '@mui/material';
import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import DialogContainer from '../Common/Overlay/DialogContainer.tsx';
import type {PublicUser} from '@package/contract';
import {FollowButton} from '../Common/Reaction/FollowButton.tsx';
import {LazyLoadImage} from '@/component/Common/LazyLoadImage';
import {useIsMobile} from '@/util/MediaQueryUtil';

// --------- Types ---------
export type Author = PublicUser;

// --------- AuthorInfo.Show ---------
export type AuthorInfoShowProps = {
  author: Author;
  onEdit?: () => void;
  showEditButton?: boolean;
  editOpen?: boolean;
  setEditOpen?: React.Dispatch<React.SetStateAction<boolean>>;
};

const AuthorInfoShowMobile: React.FC<AuthorInfoShowProps> = ({
  author,
  onEdit,
  showEditButton = true,
  editOpen,
  setEditOpen,
}) => {
  return (
    <div>
      <ArrowForwardIconContainer size={16} to={`/user/${author?.unitId}`}>
        <AccentBarWithTextContainer text={`Author: ${author?.name}`} />
      </ArrowForwardIconContainer>
      <div className="flex items-start gap-4 px-4 pt-6">
        {/* 左侧：头像 + Follow */}
        <div className="flex flex-col items-center w-24 flex-shrink-0">
          <LazyLoadImage
            src={author.avatar || ''}
            alt="avatar"
            className="w-24 h-24 rounded object-cover shadow-lg"
          />
          <div className="mt-3 w-full">
            <FollowButton
              userId={author.unitId}
              initialFollowersCount={author.followersCount}
              showFollowersText
              fullWidth
            />
          </div>
        </div>

        {/* 右侧：文字区域 */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Bio */}
          {author.bio && (
            <Typography className="text-sm leading-relaxed line-clamp-3 overflow-hidden">
              {author.bio}
            </Typography>
          )}

          {/* Description */}
          {author.description && (
            <Typography className="text-sm leading-relaxed mt-2 line-clamp-4 overflow-hidden">
              {author.description}
            </Typography>
          )}

          {/* 编辑 */}
          <div className="mt-3">
            <AuthorInfoEditContainer
              author={author}
              editOpen={editOpen ?? false}
              setEditOpen={setEditOpen!}
              mode="modal"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const AuthorInfoShow: React.FC<AuthorInfoShowProps> = ({
  author,
  onEdit,
  showEditButton = true,
  editOpen,
  setEditOpen,
}) => {
  const {t} = useTranslation();

  return (
    <div>
      <div>
        <div className="flex mb-4">
          <ArrowForwardIconContainer size={16} to={`/user/${author?.unitId}`}>
            <AccentBarWithTextContainer text={`Author: ${author?.name}`} />
          </ArrowForwardIconContainer>
        </div>

        <div className="whitespace-pre-line">
          <div>
            <div className="mb-4 mt-2 flex">
              {/* 左侧图片区域 */}
              <div className="w-1/5 flex-row justify-center">
                <LazyLoadImage
                  src={author.avatar || ''}
                  className="max-w-full max-h-full object-contain rounded"
                  alt="avatar"
                />
                <div className="mt-2 w-full">
                  <FollowButton
                    userId={author.unitId}
                    initialFollowersCount={author.followersCount}
                    showFollowersText={true}
                    fullWidth
                  />
                </div>
              </div>

              {/* 分割线 */}
              <div className="h-auto border-l border-gray-300 mx-4" />

              {/* 右侧文本区域 */}
              <div className="flex-1 !text-md">
                <Typography className="">Bio:{author.bio}</Typography>
                <br />
                <Typography className="">
                  Description:{author.description}
                </Typography>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AuthorInfoEditContainer
        author={author}
        editOpen={editOpen ?? false}
        setEditOpen={setEditOpen!}
        mode="modal"
      />
    </div>
  );
};

// --------- AuthorInfo.Container ---------
export type AuthorInfoContainerProps = {
  author: Author;
};

const AuthorInfoContainer: React.FC<AuthorInfoContainerProps> = ({author}) => {
  const [editOpen, setEditOpen] = useState(false);
  const handleEdit = () => setEditOpen(true);

  const isMobile = useIsMobile();

  if (isMobile) {
    return <AuthorInfoShowMobile author={author} />;
  } else {
    return (
      <AuthorInfoShow
        author={author}
        onEdit={handleEdit}
        editOpen={editOpen}
        setEditOpen={setEditOpen}
      />
    );
  }
};

// --------- AuthorInfoEdit.Show ---------
export type AuthorInfoEditShowProps = {
  author: Author;
  onUpdate: (description: string) => void;
  setEditOpen: React.Dispatch<React.SetStateAction<boolean>>;
  descriptionState: any;
  setDescriptionState: React.Dispatch<any>;
};

const AuthorInfoEditShow: React.FC<AuthorInfoEditShowProps> = ({
  onUpdate,
  setEditOpen,
  descriptionState,
  setDescriptionState,
}) => {
  const handleUpdate = () => {
    onUpdate(descriptionState);
    setEditOpen(false);
  };

  return (
    <div>
      <EasyEditor value={descriptionState} onChange={setDescriptionState} />
      <div className="w-full">
        <div className="w-1/2 float-right">
          <Button onClick={handleUpdate} className="w-full">
            提交
          </Button>
        </div>
      </div>
    </div>
  );
};

// --------- AuthorInfoEdit.Container ---------
export type AuthorInfoEditContainerProps = {
  author: Author;
  editOpen: boolean;
  setEditOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mode?: 'modal' | 'inline';
};

/**
 * TODO 右侧文字应当支持折叠，并且，应当扩展字段，包含作家自己的简介和平台简介，规避文字量太少造成的丑陋问题。
 * @param param0
 * @returns
 */
const AuthorInfoEditContainer: React.FC<AuthorInfoEditContainerProps> = ({
  author,
  editOpen,
  setEditOpen,
  mode = 'inline',
}) => {
  const [descriptionState, setDescriptionState] = useState(author.bio);

  useEffect(() => {
    setDescriptionState(author.bio);
  }, [author.bio]);

  const onUpdate = (newDesc: string) => {
    console.log('update', newDesc);
    // TODO: 调 API 更新作者信息
  };

  const content = (
    <AuthorInfoEditShow
      author={author}
      onUpdate={onUpdate}
      setEditOpen={setEditOpen}
      descriptionState={descriptionState}
      setDescriptionState={setDescriptionState}
    />
  );

  if (mode === 'modal') {
    return (
      <DialogContainer
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="编辑作者信息"
      >
        {content}
      </DialogContainer>
    );
  }
  return content;
};

export {
  AuthorInfoContainer,
  AuthorInfoEditContainer,
  AuthorInfoEditShow,
  AuthorInfoShow,
};

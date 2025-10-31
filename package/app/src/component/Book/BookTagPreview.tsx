import {AccentBarWithTextShow} from '@component/Common/AccentBar.tsx';
import {EditButtonFloatRight} from '@component/Common/EditButtonFloatRight.tsx';
import {Box} from '@mui/material';
import React, {useState} from 'react';
import {ArrowForwardIconContainer} from '../Common/ArrowForwardIcon.tsx';
import type {TagDetailDTO} from '@package/contract';

import {TagList} from '@/component/Tag/TagList.tsx';
import {BookTagEditContainer} from '@/component/Tag/TagEdit.tsx';

export type BookTagViewShowProps = {
  tags: TagDetailDTO[];
  onEdit?: () => void;
  showEditButton?: boolean;
  bookId: string;
  editOpen?: boolean;
  setEditOpen?: (open: boolean) => void;
  onTagClick?: (tag: TagDetailDTO) => void;
  onDomainClick?: (domainId: string) => void;
  domainLabelMap?: Record<string, string>;
};

export const BookTagViewShow: React.FC<BookTagViewShowProps> = ({
  tags,
  onEdit,
  showEditButton = true,
  bookId,
  editOpen,
  setEditOpen,
  onTagClick,
  onDomainClick,
  domainLabelMap,
}) => {
  return (
    <Box>
      <div className="flex mb-4">
        <ArrowForwardIconContainer size={16} to={`/tag/book/${bookId}`}>
          <AccentBarWithTextShow text="标签" />
        </ArrowForwardIconContainer>
        {showEditButton && <EditButtonFloatRight.Show onClick={onEdit} />}
      </div>
      <TagList
        tags={tags}
        onTagClick={onTagClick}
        onDomainClick={onDomainClick}
        domainLabelMap={domainLabelMap}
      />
      <BookTagEditContainer
        domainId={'selectedDomain'}
        bookUnitId={bookId}
        editOpen={editOpen ?? false}
        setEditOpen={setEditOpen ?? (() => {})}
        mode="modal"
      />
    </Box>
  );
};

export type BookTagViewContainerProps = {
  tags?: TagDetailDTO[];
  bookId: string;
  onTagClick?: (tag: TagDetailDTO) => void;
  onDomainClick?: (domainId: string) => void;
  domainLabelMap?: Record<string, string>;
};

export const BookTagViewContainer: React.FC<BookTagViewContainerProps> = ({
  tags,
  bookId,
  onTagClick,
  onDomainClick,
  domainLabelMap,
}) => {
  const [editOpen, setEditOpen] = useState(false);
  const handleEdit = () => {
    console.log('Edit clicked');
    setEditOpen(true);
  };

  // Mock data for development/testing
  const mockTags: TagDetailDTO[] = [
    {
      id: 'tag1',
      name: '奇幻',
      domains: ['User'],
    },
    {
      id: 'tag2',
      name: '冒险',
      domains: ['User'],
    },
    {
      id: 'tag3',
      name: '平行世界',
      domains: ['User'],
    },
    {
      id: 'tag4',
      name: '标签2-1',
      domains: ['AI'],
    },
    {
      id: 'tag5',
      name: '标签2-2',
      domains: ['AI'],
    },
    {
      id: 'tag6',
      name: '标签2-3',
      domains: ['AI'],
    },
  ];

  const displayTags = tags || mockTags;

  return (
    <BookTagViewShow
      tags={displayTags}
      onEdit={handleEdit}
      bookId={bookId}
      editOpen={editOpen}
      setEditOpen={setEditOpen}
      onTagClick={onTagClick}
      onDomainClick={onDomainClick}
      domainLabelMap={domainLabelMap}
    />
  );
};

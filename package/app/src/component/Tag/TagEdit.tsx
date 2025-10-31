import DialogContainer from '@component/Common/DialogContainer.tsx';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  TextField,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import Menu from '@mui/material/Menu';
import type {TagDTO} from '@package/contract';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import React, {useState} from 'react';
import {tagApi, tagQueries} from '@/api/tag';

/**
 * Autocomplete for selecting domain/organization
 * TODO: Replace hardcoded list with actual API call to fetch user's domains
 */
export function TagEditAutocomplete({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  // TODO: Fetch from API - this should be user's subscribed domains
  const domainList = [
    {id: 'domain-1', name: 'Harem Heaven'},
    {id: 'domain-2', name: 'Science fiction enthusiast'},
    {id: 'domain-3', name: 'Fantasy lover'},
    {id: 'domain-4', name: 'Historical fiction lover'},
    {id: 'domain-5', name: 'Mystery lover'},
    {id: 'domain-6', name: 'Thriller lover'},
    {id: 'domain-7', name: 'Romance lover'},
    {id: 'domain-8', name: 'Western lover'},
  ];

  return (
    <Autocomplete
      options={domainList}
      getOptionLabel={option => option.name}
      value={domainList.find(d => d.id === value) || null}
      onChange={(_, newValue) => {
        onChange(newValue?.id || '');
      }}
      renderInput={params => <TextField {...params} label="Organization" />}
      className="w-full"
    />
  );
}

/**
 * Chip component with edit/delete menu
 */
interface TagEditChipProps {
  tag: TagDTO;
  onEdit: (tag: TagDTO) => void;
  onDelete: (tag: TagDTO) => void;
}

const TagEditChip = ({tag, onEdit, onDelete}: TagEditChipProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [openMenu, setOpenMenu] = useState(false);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    setAnchorEl(event.currentTarget);
    setOpenMenu(true);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setOpenMenu(false);
  };

  const handleEdit = () => {
    onEdit(tag);
    handleClose();
  };

  const handleDelete = () => {
    onDelete(tag);
    handleClose();
  };

  return (
    <div className="inline-flex items-center">
      <Chip
        label={tag.name}
        className="bg-gray-100 text-gray-700 border rounded-xl cursor-pointer"
        onClick={handleClick}
        size="small"
      />
      <Menu
        anchorEl={anchorEl}
        open={openMenu}
        onClose={handleClose}
        PaperProps={{
          elevation: 3,
          sx: {
            '& .MuiMenuItem-root': {
              fontSize: '14px',
              padding: '8px 16px',
              color: 'black',
            },
          },
        }}
      >
        <MenuItem onClick={handleEdit}>Edit</MenuItem>
        <MenuItem onClick={handleDelete}>Delete</MenuItem>
      </Menu>
    </div>
  );
};

/**
 * Edit single tag form
 */
interface EditSingleTagProps {
  tag: TagDTO;
  onBack: () => void;
}

function EditSingleTag({tag, onBack}: EditSingleTagProps) {
  const queryClient = useQueryClient();
  const [tagName, setTagName] = useState(tag.name);
  const [tagType, setTagType] = useState(tag.type || '');

  const updateMutation = useMutation({
    mutationFn: () =>
      tagApi.update(tag.id, {
        name: tagName,
        type: tagType || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['tag']});
      onBack();
    },
  });

  return (
    <div className="mt-6">
      <div className="flex justify-between mb-4">
        <Button variant="outlined" color="primary" onClick={onBack}>
          Back
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending || !tagName.trim()}
        >
          {updateMutation.isPending ? 'Updating...' : 'Update'}
        </Button>
      </div>
      <Box display="flex" flexDirection="column" gap={2}>
        <TextField
          label="Tag Name"
          value={tagName}
          onChange={e => setTagName(e.target.value)}
          fullWidth
        />
        <TextField
          label="Tag Type (optional)"
          value={tagType}
          onChange={e => setTagType(e.target.value)}
          placeholder="e.g., genre, author, general"
          fullWidth
        />
      </Box>
    </div>
  );
}

/**
 * Main tag editor component
 */

export type BookTagEditShowProps = {
  bookUnitId: string;
  domainId: string;
};

export const BookTagEditShow: React.FC<BookTagEditShowProps> = ({
  bookUnitId,
  domainId,
}) => {
  const queryClient = useQueryClient();
  const [selectedDomain, setSelectedDomain] = useState(domainId);
  const [editingTag, setEditingTag] = useState<TagDTO | null>(null);
  const [newTagName, setNewTagName] = useState('');

  // Fetch tags attached to this book
  const {data: bookTags, isLoading: isLoadingBookTags} = useQuery(
    tagQueries.list({objectId: bookUnitId, limit: 100}),
  );

  // Fetch available tags in the domain
  const {data: domainTags} = useQuery(
    tagQueries.list({domainId: selectedDomain, limit: 1000}),
  );

  // Detach tag from book
  const detachMutation = useMutation({
    mutationFn: (tagId: string) => tagApi.detachFromUnit(tagId, bookUnitId),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['tag']});
    },
  });

  // Attach existing tag to book
  const attachMutation = useMutation({
    mutationFn: (tagId: string) => tagApi.attachToUnit(tagId, bookUnitId),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['tag']});
    },
  });

  // Create new tag and attach to book
  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const newTag = await tagApi.create({
        name,
        type: 'book',
        domains: [selectedDomain],
      });
      await tagApi.attachToUnit(newTag.id, bookUnitId);
      return newTag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['tag']});
      setNewTagName('');
    },
  });

  const existingTagIds = new Set(bookTags?.tags.map(t => t.id) ?? []);
  const availableTags =
    domainTags?.tags.filter(t => !existingTagIds.has(t.id)) ?? [];

  if (editingTag) {
    return (
      <EditSingleTag tag={editingTag} onBack={() => setEditingTag(null)} />
    );
  }

  return (
    <div>
      <Alert severity="info" className="mb-4">
        点击 Tag
        来编辑。你只会搜索到你订阅的组织，如果想要编辑某个组织的标签，请去[这里]管理组织订阅
      </Alert>

      {/* Domain selector and add button */}
      <div className="flex justify-between gap-4 mb-4">
        <div className="flex-1">
          <TagEditAutocomplete
            value={selectedDomain}
            onChange={setSelectedDomain}
          />
        </div>
      </div>

      {/* Add new tag */}
      <Box display="flex" gap={2} mb={4}>
        <TextField
          label="Create New Tag"
          value={newTagName}
          onChange={e => setNewTagName(e.target.value)}
          placeholder="Enter tag name"
          size="small"
          fullWidth
        />
        <Button
          variant="contained"
          color="primary"
          onClick={() => createMutation.mutate(newTagName)}
          disabled={createMutation.isPending || !newTagName.trim()}
        >
          Add
        </Button>
      </Box>

      {/* Add existing tags from domain */}
      <Box mb={4}>
        <Autocomplete
          options={availableTags}
          getOptionLabel={option => option.name}
          renderInput={params => (
            <TextField
              {...params}
              label="Add Existing Tag from Domain"
              size="small"
            />
          )}
          onChange={(_, tag) => {
            if (tag) {
              attachMutation.mutate(tag.id);
            }
          }}
          value={null}
          fullWidth
        />
      </Box>

      {/* Current tags */}
      {isLoadingBookTags ? (
        <CircularProgress size={24} />
      ) : (
        <div className="flex flex-wrap gap-2">
          {bookTags?.tags.map(tag => (
            <TagEditChip
              key={tag.id}
              tag={tag}
              onEdit={t => setEditingTag(t)}
              onDelete={t => detachMutation.mutate(t.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export type BookTagEditContainerProps = {
  bookUnitId: string;
  domainId: string;
  editOpen: boolean;
  setEditOpen: (open: boolean) => void;
  mode?: 'modal' | 'inline';
};

export const BookTagEditContainer: React.FC<BookTagEditContainerProps> = ({
  bookUnitId,
  domainId,
  editOpen,
  setEditOpen,
  mode = 'inline',
}) => {
  const content = (
    <BookTagEditShow bookUnitId={bookUnitId} domainId={domainId} />
  );

  if (mode === 'modal') {
    return (
      <DialogContainer
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Book Tags"
      >
        <div className="min-h-[500px]">{content}</div>
      </DialogContainer>
    );
  }

  return content;
};

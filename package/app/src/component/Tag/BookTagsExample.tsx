/**
 * Example: How to properly use Tags with the backend contract
 *
 * This replaces the incorrect "TagGroup" concept with the actual Tag system
 */

import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {Chip, Box, Typography, Autocomplete, TextField} from '@mui/material';
import {tagApi, tagQueries} from '@/api/tag';
import type {TagDTO} from '@package/contract';
import {useMemo} from 'react';

// ============================================================================
// Example 1: Display all tags for a book
// ============================================================================
interface BookTagsProps {
  bookUnitId: string;
}

export function BookTags({bookUnitId}: BookTagsProps) {
  const {data, isLoading} = useQuery(
    tagQueries.list({objectId: bookUnitId, limit: 100}),
  );

  if (isLoading) return <div>Loading tags...</div>;

  return (
    <Box display="flex" flexWrap="wrap" gap={1}>
      {data?.tags.map(tag => (
        <Chip
          key={tag.id}
          label={tag.name}
          size="small"
          sx={{
            bgcolor: 'grey.100',
            color: 'primary.main',
            '&:hover': {bgcolor: 'grey.200'},
          }}
        />
      ))}
    </Box>
  );
}

// ============================================================================
// Example 2: Group tags by type (client-side grouping)
// ============================================================================
type TagGroup = {
  type: string;
  tags: TagDTO[];
};

function useTagsByType(bookUnitId: string): TagGroup[] {
  const {data} = useQuery(tagQueries.list({objectId: bookUnitId, limit: 100}));

  return useMemo(() => {
    if (!data?.tags) return [];

    const groups = new Map<string, TagDTO[]>();

    data.tags.forEach(tag => {
      const type = tag.type || 'general';
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(tag);
    });

    return Array.from(groups.entries()).map(([type, tags]) => ({
      type,
      tags,
    }));
  }, [data]);
}

export function BookTagsGrouped({bookUnitId}: BookTagsProps) {
  const tagGroups = useTagsByType(bookUnitId);

  return (
    <Box>
      {tagGroups.map(group => (
        <Box key={group.type} mb={2}>
          <Typography variant="subtitle2" fontWeight="bold" mb={1}>
            {group.type}
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={1}>
            {group.tags.map(tag => (
              <Chip
                key={tag.id}
                label={tag.name}
                size="small"
                sx={{
                  bgcolor: 'grey.100',
                  color: 'primary.main',
                }}
              />
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

// ============================================================================
// Example 3: Display only specific type of tags (e.g., genres)
// ============================================================================
interface BookTagsByTypeProps {
  bookUnitId: string;
  tagType: string;
  label?: string;
}

export function BookTagsByType({
  bookUnitId,
  tagType,
  label,
}: BookTagsByTypeProps) {
  const {data} = useQuery(
    tagQueries.list({objectId: bookUnitId, type: tagType, limit: 100}),
  );

  if (!data?.tags.length) return null;

  return (
    <Box mb={2}>
      {label && (
        <Typography variant="subtitle2" fontWeight="bold" mb={1}>
          {label}
        </Typography>
      )}
      <Box display="flex" flexWrap="wrap" gap={1}>
        {data.tags.map(tag => (
          <Chip
            key={tag.id}
            label={tag.name}
            size="small"
            sx={{
              bgcolor: 'grey.100',
              color: 'primary.main',
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

// ============================================================================
// Example 4: Tag editor with attach/detach functionality
// ============================================================================
interface TagEditorProps {
  bookUnitId: string;
  domainId: string; // The organization/user domain
}

export function TagEditor({bookUnitId, domainId}: TagEditorProps) {
  const queryClient = useQueryClient();

  // Fetch existing tags on this book
  const {data: existingTags} = useQuery(
    tagQueries.list({objectId: bookUnitId, limit: 100}),
  );

  // Fetch available tags in the domain (for autocomplete)
  const {data: domainTags} = useQuery(tagQueries.list({domainId, limit: 1000}));

  // Detach tag from book
  const detachTag = useMutation({
    mutationFn: ({tagId}: {tagId: string}) =>
      tagApi.detachFromUnit(tagId, bookUnitId),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['tag', 'list']});
    },
  });

  // Attach existing tag to book
  const attachTag = useMutation({
    mutationFn: ({tagId}: {tagId: string}) =>
      tagApi.attachToUnit(tagId, bookUnitId),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['tag', 'list']});
    },
  });

  // Create new tag and attach to book
  const _createAndAttachTag = useMutation({
    mutationFn: async ({name, type}: {name: string; type?: string | null}) => {
      // Create new tag
      const newTag = await tagApi.create({
        name,
        type,
        domains: [domainId],
      });

      // Attach to book
      await tagApi.attachToUnit(newTag.id, bookUnitId);

      return newTag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['tag', 'list']});
    },
  });

  const existingTagIds = new Set(existingTags?.tags.map(t => t.id) ?? []);
  const availableTags =
    domainTags?.tags.filter(t => !existingTagIds.has(t.id)) ?? [];

  return (
    <Box>
      {/* Display existing tags with delete option */}
      <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
        {existingTags?.tags.map(tag => (
          <Chip
            key={tag.id}
            label={tag.name}
            size="small"
            onDelete={() => detachTag.mutate({tagId: tag.id})}
            sx={{
              bgcolor: 'grey.100',
              color: 'primary.main',
            }}
          />
        ))}
      </Box>

      {/* Autocomplete to add existing tags */}
      <Autocomplete
        options={availableTags}
        getOptionLabel={option => option.name}
        renderInput={params => (
          <TextField {...params} label="Add existing tag" size="small" />
        )}
        onChange={(_, tag) => {
          if (tag) {
            attachTag.mutate({tagId: tag.id});
          }
        }}
        fullWidth
      />

      {/* Note: You can add a separate input to create new tags */}
    </Box>
  );
}

// ============================================================================
// Example 5: Complete book tags section with multiple tag types
// ============================================================================
export function BookTagsComplete({bookUnitId}: BookTagsProps) {
  return (
    <Box>
      <BookTagsByType bookUnitId={bookUnitId} tagType="genre" label="Genres" />
      <BookTagsByType
        bookUnitId={bookUnitId}
        tagType="author"
        label="Authors"
      />
      <BookTagsByType bookUnitId={bookUnitId} tagType="general" label="Tags" />
    </Box>
  );
}

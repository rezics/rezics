import {CollapsibleByLineText} from '@component/Common/CollapsibleByLineText';
import {Box, Chip, CircularProgress, Typography} from '@mui/material';
import type {TagDTO} from '@package/contract';
import {useQuery} from '@tanstack/react-query';
import {useMemo} from 'react';
import {tagQueries} from '@/api/tag';

/**
 * Display tags for a book, grouped by type
 */
interface BookTagsByTypeProps {
  bookUnitId: string;
  type?: string;
  label?: string;
}

export function BookTagsByType({bookUnitId, type, label}: BookTagsByTypeProps) {
  const {data, isLoading} = useQuery(
    tagQueries.list({objectId: bookUnitId, type, limit: 100}),
  );

  if (isLoading) {
    return <CircularProgress size={20} />;
  }

  if (!data?.tags.length) {
    return null;
  }

  return (
    <Box mb={2}>
      {label && (
        <Typography variant="subtitle2" fontWeight="bold" mb={1}>
          {label}
        </Typography>
      )}
      <CollapsibleByLineText.Container maxLines={2}>
        <Box display="flex" flexWrap="wrap" gap={1}>
          {data.tags.map(tag => (
            <Chip
              key={tag.id}
              label={`#${tag.name}`}
              size="small"
              onClick={() => {
                console.log(`Clicked tag: ${tag.name}`);
                // TODO: Navigate to tag search page or filter
              }}
              sx={{
                bgcolor: 'grey.100',
                color: 'primary.main',
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: 'grey.200',
                },
              }}
            />
          ))}
        </Box>
      </CollapsibleByLineText.Container>
    </Box>
  );
}

/**
 * Display all tags for a book (without grouping)
 */
interface BookTagsProps {
  bookUnitId: string;
}

export function BookTags({bookUnitId}: BookTagsProps) {
  const {data, isLoading} = useQuery(
    tagQueries.list({objectId: bookUnitId, limit: 100}),
  );

  if (isLoading) {
    return <CircularProgress size={20} />;
  }

  if (!data?.tags.length) {
    return null;
  }

  return (
    <CollapsibleByLineText.Container maxLines={2}>
      <Box display="flex" flexWrap="wrap" gap={1}>
        {data.tags.map(tag => (
          <Chip
            key={tag.id}
            label={`#${tag.name}`}
            size="small"
            onClick={() => {
              console.log(`Clicked tag: ${tag.name}`);
            }}
            sx={{
              bgcolor: 'grey.100',
              color: 'primary.main',
              cursor: 'pointer',
              '&:hover': {
                bgcolor: 'grey.200',
              },
            }}
          />
        ))}
      </Box>
    </CollapsibleByLineText.Container>
  );
}

/**
 * Display tags grouped by type with section headers
 */
export function BookTagsGrouped({bookUnitId}: BookTagsProps) {
  const {data, isLoading} = useQuery(
    tagQueries.list({objectId: bookUnitId, limit: 100}),
  );

  const tagGroups = useMemo(() => {
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

  if (isLoading) {
    return <CircularProgress size={20} />;
  }

  if (!tagGroups.length) {
    return null;
  }

  return (
    <Box>
      {tagGroups.map(group => (
        <Box key={group.type} mb={2}>
          <Typography variant="subtitle2" fontWeight="bold" mb={1}>
            {group.type}
          </Typography>
          <CollapsibleByLineText.Container maxLines={2}>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {group.tags.map(tag => (
                <Chip
                  key={tag.id}
                  label={`#${tag.name}`}
                  size="small"
                  onClick={() => {
                    console.log(`Clicked tag: ${tag.name}`);
                  }}
                  sx={{
                    bgcolor: 'grey.100',
                    color: 'primary.main',
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'grey.200',
                    },
                  }}
                />
              ))}
            </Box>
          </CollapsibleByLineText.Container>
        </Box>
      ))}
    </Box>
  );
}

/**
 * Backward compatibility: Display tags with a specific type and title
 * @deprecated Use BookTagsByType instead
 */
export function SingleBookTag({
  bookUnitId,
  type = 'book',
  title,
}: {
  bookUnitId: string;
  type?: string;
  title?: string;
}) {
  return <BookTagsByType bookUnitId={bookUnitId} type={type} label={title} />;
}

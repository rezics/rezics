import {Box, Chip, Stack, Typography} from '@mui/material';
import type {TagDetailDTO} from '@package/contract';

export type DomainGroupedTags = Record<string, TagDetailDTO[]>; // key = domainId ("__no_domain__" when none)

const NO_DOMAIN = '__no_domain__';

function groupByDomain(tags: TagDetailDTO[]): DomainGroupedTags {
  const groups: DomainGroupedTags = {};
  for (const tag of tags) {
    const domains =
      tag.domains && tag.domains.length ? tag.domains : [NO_DOMAIN];
    for (const d of domains) {
      if (!groups[d]) groups[d] = [];
      groups[d].push(tag);
    }
  }
  return groups;
}

export type TagListProps = {
  tags: TagDetailDTO[];
  onTagClick?: (tag: TagDetailDTO) => void;
  onDomainClick?: (domainId: string) => void;
  domainLabelMap?: Record<string, string>; // optional pretty names for domain ids
};

export const TagList = ({
  tags,
  onTagClick,
  onDomainClick,
  domainLabelMap,
}: TagListProps) => {
  const grouped = groupByDomain(tags);
  const domainIds = Object.keys(grouped);

  return (
    <Stack spacing={3}>
      {domainIds.map(domainId => (
        <Box key={domainId}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{mb: 1}}>
            <Typography
              variant="subtitle1"
              fontWeight={600}
              sx={{cursor: onDomainClick ? 'pointer' : 'default'}}
              onClick={() => onDomainClick && onDomainClick(domainId)}
            >
              {domainId === NO_DOMAIN
                ? 'Other'
                : domainLabelMap?.[domainId] ?? domainId}
            </Typography>
          </Stack>
          <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
            {grouped[domainId].map(tag => (
              <Chip
                key={tag.id}
                label={`#${tag.name}`}
                size="small"
                onClick={onTagClick ? () => onTagClick(tag) : undefined}
              />
            ))}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
};

import React from 'react';
import {Card, CardContent, Typography, Chip} from '@mui/material';
import type {TagDetailDTO} from '@package/api/tag/tag';
import {RouterLink} from '../../../../ui/src/Navigation/RouterLink';

/**
 * Generic card showing a tag's primary information
 * Layout uses div + Tailwind for spacing instead of MUI Box.
 */
export const TagCard: React.FC<{
  tag: TagDetailDTO;
  onClick?: (tag: TagDetailDTO) => void;
  selected?: boolean;
}> = ({tag, onClick, selected}) => {
  return (
    <div
      className={
        'cursor-pointer transition border rounded-md p-3 flex flex-col gap-1 hover:shadow-sm ' +
        (selected ? 'border-blue-500 shadow' : 'border-gray-200')
      }
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(tag)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(tag);
        }
      }}
      data-tag-id={tag.id}
    >
      <div className="flex items-center gap-2">
        <Chip
          size="small"
          label={tag.name}
          color={selected ? 'primary' : 'default'}
        />
        {tag.type && (
          <span className="text-xs text-gray-500 font-mono">{tag.type}</span>
        )}
      </div>
      {tag.domains && tag.domains.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {tag.domains.map(d => (
            <span
              key={d}
              className="text-[10px] px-1 py-0.5 rounded bg-gray-100 text-gray-600"
            >
              {d.slice(0, 6)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Detailed card – wiki-style description from tag.content (unit content) and link to detail page.
 */
export const TagDetailCard: React.FC<{
  tag: TagDetailDTO;
  onNavigate?: (tag: TagDetailDTO) => void;
}> = ({tag}) => {
  return (
    <Card elevation={0} className="border border-gray-200 rounded-md">
      <CardContent className="space-y-2">
        <Typography variant="h6" component="div">
          {tag.name}{' '}
          {tag.type && (
            <span className="ml-2 text-xs font-normal text-gray-500 align-middle">
              {tag.type}
            </span>
          )}
        </Typography>
        {tag.content ? (
          <Typography
            component="div"
            className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap"
          >
            {tag.content}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            无描述内容
          </Typography>
        )}
        <div>
          <RouterLink
            href={`/tag/${tag.id}`}
            className="text-sm text-blue-600 hover:underline"
          >
            查看详情 →
          </RouterLink>
          <RouterLink
            href={`/book?tags=${tag.name}`}
            className="text-sm text-blue-600 hover:underline !ml-8"
          >
            搜索标签 →
          </RouterLink>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Collection exports – extendable for more specialized tag cards later.
 */
export default TagCard;

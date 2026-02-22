import {useQuery} from '@tanstack/react-query';
import {Avatar, Chip, Paper, Tooltip, Typography} from '@mui/material';
import {useTranslation} from 'react-i18next';

import {unitDetailQuery} from '@package/api/unit/unit';
import {AccentBarContainer} from '@/component/Common/Navigation/AccentBar';
import {MarkdownContent} from '@/component/Common/MarkdownContent';
import {MUILink} from '@package/ui/primitive/link/MUILink.tsx';
import {unitRoute} from '@/router';

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) return '-';

  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch (e) {
    return String(value);
  }
}

export function UnitPage() {
  const {unitId} = unitRoute.useParams();
  const {t} = useTranslation();

  const {
    data: unit,
    isLoading,
    error,
  } = useQuery(unitDetailQuery(unitId || ''));

  if (isLoading) {
    return (
      <div className="mt-6 text-center text-sm text-gray-500">Loading...</div>
    );
  }

  if (error instanceof Error) {
    return (
      <div className="mt-6 text-center text-sm text-red-500">
        Error: {error.message}
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="mt-6 text-center text-sm text-gray-500">
        {t('common.no_data')}
      </div>
    );
  }

  const metadataEntries = Object.entries(unit.metadata ?? {});

  return (
    <div className="w-11/12 max-w-4xl mx-auto mt-10 mb-10">
      {/* ANCHOR Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <Typography variant="h4" className="font-bold">
            {unit.title || t('pages.unit_page', 'Unit')}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            className="text-xs sm:text-sm break-all"
          >
            ID: {unit.id}
          </Typography>
        </div>

        <div className="flex flex-wrap gap-2 mt-1 sm:mt-0 justify-start sm:justify-end">
          {unit.type && (
            <Chip
              label={unit.type}
              color="primary"
              size="small"
              variant="outlined"
            />
          )}
          {unit.status && (
            <Chip
              label={unit.status}
              size="small"
              variant="outlined"
              color="default"
            />
          )}
          {unit.tags?.map(tag => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              variant="outlined"
              sx={{borderRadius: 999}}
            />
          ))}
        </div>
      </div>

      {/* ANCHOR User & basic meta */}
      {(unit.user || unit.createdAt || unit.updatedAt) && (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {unit.user && (
            <div className="flex items-center gap-3">
              <Avatar
                src={unit.user.avatar ?? ''}
                sx={{width: 40, height: 40, borderRadius: 1}}
              />
              <div className="flex flex-col">
                <Tooltip title={t('user.open_profile')}>
                  <MUILink
                    to="/user/$unitId"
                    params={{unitId: unit.user.unitId}}
                    className="text-sm font-medium"
                  >
                    {unit.user.name}
                  </MUILink>
                </Tooltip>
                <Typography variant="caption" color="text.secondary">
                  {unit.user.slug}
                </Typography>
              </div>
            </div>
          )}

          <div className="text-xs space-y-0.5 sm:text-right">
            {unit.createdAt && (
              <div>
                {t('common.created_at')}: {String(unit.createdAt)}
              </div>
            )}
            {unit.updatedAt && (
              <div>
                {t('common.updated_at')}: {String(unit.updatedAt)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ANCHOR Content */}
      <div className="mt-8">
        <Paper className="p-5">
          {unit.content ? (
            <MarkdownContent content={unit.content} />
          ) : (
            <Typography variant="body2" color="text.secondary">
              {t('unit.no_content')}
            </Typography>
          )}
        </Paper>
      </div>

      {/* ANCHOR Metadata */}
      <div className="mt-10">
        <div className="flex items-center gap-2 mb-4">
          <AccentBarContainer />
          <Typography variant="h6" className="font-bold">
            {t('unit.meta_data')}
          </Typography>
        </div>

        {metadataEntries.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('unit.no_metadata', '暂无 Meta 信息')}
          </Typography>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {metadataEntries.map(([key, value]) => (
              <Paper key={key} className="p-4">
                <Typography variant="subtitle2" className="font-semibold">
                  {key}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  className="mt-1 whitespace-pre-wrap break-words"
                >
                  {formatMetadataValue(value)}
                </Typography>
              </Paper>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

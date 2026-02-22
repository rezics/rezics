import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React from 'react';
import {useQuery} from '@tanstack/react-query';

import {Link} from '@package/ui/primitive/link/Link.tsx';
import {unitQueries, type UnitDTO} from '@package/api/unit/unit';
import {unitMutations} from '@package/api/unit/unit.mutations';

import {Page} from '@/core/layout/Page';
import {Route} from '@/routes/_admin/units/$unitId';

function fmtDate(v?: string | Date) {
  if (!v) return '';
  const d = typeof v === 'string' ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
}

function toJsonText(value: unknown) {
  if (value == null) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function UnitEditPage() {
  const {unitId} = Route.useParams();
  const [error, setError] = React.useState<string | null>(null);

  const detailQuery = useQuery(unitQueries.detail(unitId));

  const updateMutation = unitMutations.useUpdate({
    onError: err =>
      setError(err instanceof Error ? err.message : 'Update failed'),
    onSuccess: () => setError(null),
  });

  const [status, setStatus] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [targetUnitId, setTargetUnitId] = React.useState('');
  const [metadataText, setMetadataText] = React.useState('');

  React.useEffect(() => {
    const u: UnitDTO | undefined = detailQuery.data;
    if (!u) return;
    setStatus(u.status ?? '');
    setTitle(u.title ?? '');
    setContent(u.content ?? '');
    setTargetUnitId(u.targetUnitId ?? '');
    setMetadataText(toJsonText(u.metadata));
  }, [detailQuery.data]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let metadata: any = undefined;
    const trimmedMetadata = metadataText.trim();
    if (trimmedMetadata.length > 0) {
      try {
        metadata = JSON.parse(trimmedMetadata);
      } catch {
        setError('Metadata must be valid JSON.');
        return;
      }
    }

    await updateMutation.mutateAsync({
      unitId,
      input: {
        status: status.trim() || undefined,
        title: title.trim() || undefined,
        content: content.trim() || undefined,
        targetUnitId: targetUnitId.trim() || undefined,
        metadata,
      } as any,
    });

    await detailQuery.refetch();
  }

  return (
    <Page title="Edit Unit" description={`编辑 Unit：${unitId}`}>
      <Card>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{mb: 1}}>
            <Button
              component={Link}
              to="/units"
              startIcon={<ArrowBackIcon />}
              variant="text"
            >
              Back
            </Button>
            <Box sx={{flex: 1}} />
          </Stack>

          <Divider sx={{my: 2}} />

          {detailQuery.isLoading ? (
            <Box sx={{display: 'flex', justifyContent: 'center', py: 6}}>
              <CircularProgress size={24} />
            </Box>
          ) : detailQuery.isError ? (
            <Box>
              <Alert severity="error">Failed to load unit.</Alert>
              {detailQuery.error ? (
                <Typography color="error" variant="caption">
                  {String(detailQuery.error)}
                </Typography>
              ) : null}
            </Box>
          ) : (
            <>
              {error ? (
                <Alert severity="error" sx={{mb: 2}}>
                  {error}
                </Alert>
              ) : null}

              <Stack spacing={0.5} sx={{mb: 2}}>
                <Typography variant="body2" color="text.secondary">
                  ID: <strong>{detailQuery.data?.id ?? '-'}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  User ID: <strong>{detailQuery.data?.userId ?? '-'}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Type: <strong>{detailQuery.data?.type ?? '-'}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Created:{' '}
                  <strong>{fmtDate(detailQuery.data?.createdAt)}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Updated:{' '}
                  <strong>{fmtDate(detailQuery.data?.updatedAt)}</strong>
                </Typography>
              </Stack>

              <Box component="form" onSubmit={onSubmit}>
                <Stack spacing={2}>
                  <TextField
                    label="Status"
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                    placeholder="ACTIVE / DRAFT / ..."
                  />
                  <TextField
                    label="Title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                  <TextField
                    label="Content"
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    multiline
                    minRows={8}
                  />
                  <TextField
                    label="Target Unit ID"
                    value={targetUnitId}
                    onChange={e => setTargetUnitId(e.target.value)}
                  />
                  <TextField
                    label="Metadata (JSON)"
                    value={metadataText}
                    onChange={e => setMetadataText(e.target.value)}
                    multiline
                    minRows={6}
                    placeholder='{"key":"value"}'
                  />

                  <Box>
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={<SaveIcon />}
                      disabled={updateMutation.isPending}
                    >
                      {updateMutation.isPending ? 'Saving…' : 'Save'}
                    </Button>
                  </Box>
                </Stack>
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}

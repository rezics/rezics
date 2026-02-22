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
import {userQueries} from '@package/api/user/user.queries';
import {userMutations} from '@package/api/user/user.mutations';

import {Page} from '@/core/layout/Page';
import {Route} from '@/routes/_admin/users/$unitId';

export default function UserEditPage() {
  const {unitId} = Route.useParams();
  const [error, setError] = React.useState<string | null>(null);

  const detailQuery = useQuery(userQueries.adminDetail(unitId));

  const updateMutation = userMutations.useAdminUpdate({
    onError: err =>
      setError(err instanceof Error ? err.message : 'Update failed'),
    onSuccess: () => setError(null),
  });

  const [name, setName] = React.useState('');
  const [avatar, setAvatar] = React.useState('');
  const [bio, setBio] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [password, setPassword] = React.useState('');

  React.useEffect(() => {
    const u = detailQuery.data;
    if (!u) return;
    setName(u.name ?? '');
    setAvatar(u.avatar ?? '');
    setBio(u.bio ?? '');
    setDescription(u.description ?? '');
    setPassword('');
  }, [detailQuery.data]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    await updateMutation.mutateAsync({
      unitId,
      input: {
        name: name.trim() || undefined,
        avatar: avatar.trim() || undefined,
        bio: bio.trim() || undefined,
        description: description.trim() || undefined,
        password: password.length ? password : undefined,
      } as any,
    });
    setPassword('');
    await detailQuery.refetch();
  }

  return (
    <Page title="Edit User" description={`编辑用户：${unitId}`}>
      <Card>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{mb: 1}}>
            <Button
              component={Link}
              to="/users"
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
            <Alert severity="error">Failed to load user.</Alert>
          ) : (
            <>
              {error ? (
                <Alert severity="error" sx={{mb: 2}}>
                  {error}
                </Alert>
              ) : null}

              <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                Email: <strong>{detailQuery.data?.email ?? '-'}</strong>
              </Typography>

              <Box component="form" onSubmit={onSubmit}>
                <Stack spacing={2}>
                  <TextField
                    label="Name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                  <TextField
                    label="Avatar URL"
                    value={avatar}
                    onChange={e => setAvatar(e.target.value)}
                  />
                  <TextField
                    label="Bio"
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    multiline
                    minRows={2}
                  />
                  <TextField
                    label="Description"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    multiline
                    minRows={4}
                  />
                  <TextField
                    label="New Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    type="password"
                    helperText="留空表示不修改密码"
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

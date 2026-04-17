import {
  Alert,
  Avatar,
  Button,
  CircularProgress,
  TextField,
  Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import { userQueries } from '@rezics/api/user/user.queries';
import { useUpdateMeMutation } from '@rezics/api/user/user.mutations';
import type { UpdateUser } from '@rezics/contract';
import { RezicsMarkdownEditor } from '@rezics/ui/editor';
import { useQuery } from '@tanstack/react-query';
import { type FC, useEffect, useState } from 'react';
import { SettingsSection } from '@/user/components/SettingsSection';
import { useRequireAuth } from '@/user/pages/useAuth';

export const SettingsProfileSection: FC = () => {
  useRequireAuth();

  const { data: user, isLoading } = useQuery(userQueries.me());
  const [formData, setFormData] = useState<UpdateUser>({
    name: '',
    avatar: '',
    bio: '',
    description: '',
  });
  const [success, setSuccess] = useState(false);

  const updateMe = useUpdateMeMutation({
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    },
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name ?? '',
        avatar: user.avatar ?? '',
        bio: user.bio ?? '',
        description: user.description ?? '',
      });
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <CircularProgress />
      </div>
    );
  }

  const handleChange = (field: keyof UpdateUser, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMe.mutate({
      name: formData.name || undefined,
      avatar: formData.avatar || undefined,
      bio: formData.bio || undefined,
      description: formData.description || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <SettingsSection
        title="Public Profile"
        description="This information will be displayed publicly on your profile page."
      >
        {success && (
          <Alert severity="success" className="mb-4">
            Profile updated successfully.
          </Alert>
        )}
        {updateMe.error && (
          <Alert severity="error" className="mb-4">
            {updateMe.error.message}
          </Alert>
        )}

        <div className="flex items-center gap-4 mb-6">
          <Avatar
            src={formData.avatar}
            variant="rounded"
            sx={{ width: 72, height: 72, borderRadius: 2 }}
          >
            {formData.name?.charAt(0).toUpperCase()}
          </Avatar>
          <div className="flex-1">
            <TextField
              fullWidth
              label="Avatar URL"
              value={formData.avatar}
              onChange={(e) => handleChange('avatar', e.target.value)}
              variant="standard"
              placeholder="https://example.com/avatar.jpg"
            />
          </div>
        </div>

        <div className="space-y-5">
          <TextField
            fullWidth
            label="Display Name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            variant="standard"
            required
          />

          {user?.slug && (
            <div>
              <Typography variant="caption" color="text.secondary">
                Username
              </Typography>
              <Typography variant="body2" className="mt-1">
                @{user.slug}
              </Typography>
            </div>
          )}

          <TextField
            fullWidth
            label="Bio"
            value={formData.bio}
            onChange={(e) => handleChange('bio', e.target.value)}
            variant="standard"
            multiline
            rows={2}
            placeholder="A short bio about yourself"
          />

          <div>
            <Typography
              variant="caption"
              color="text.secondary"
              className="mb-2 block"
            >
              Description
            </Typography>
            <RezicsMarkdownEditor
              value={formData.description ?? ''}
              onChange={(value) => handleChange('description', value)}
            />
          </div>
        </div>
      </SettingsSection>

      <div className="flex justify-end py-4">
        <Button
          type="submit"
          variant="contained"
          startIcon={
            updateMe.isPending ? (
              <CircularProgress size={18} color="inherit" />
            ) : (
              <SaveIcon />
            )
          }
          disabled={updateMe.isPending}
        >
          Save Profile
        </Button>
      </div>
    </form>
  );
};

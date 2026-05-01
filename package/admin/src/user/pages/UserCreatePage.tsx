import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { userMutations } from "@rezics/api/user/user.mutations";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { useNavigate } from "@tanstack/react-router";
import React from "react";

import { Page } from "@/core/layouts/Page";

export default function UserCreatePage() {
  const navigate = useNavigate();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [avatar, setAvatar] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const createMutation = userMutations.useAdminCreate({
    onError: (err: unknown) =>
      setError(err instanceof Error ? err.message : "Create failed"),
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const user = await createMutation.mutateAsync({
      email: email.trim(),
      password,
      slug: slug.trim(),
      avatar: avatar.trim() || undefined,
      bio: bio.trim() || undefined,
    });
    await navigate({ to: `/user/${user.unitId}`, replace: true });
  }

  return (
    <Page title="Create User" description="创建一个新用户（Admin）">
      <Card>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Button
              component={Link}
              to="/user"
              startIcon={<ArrowBackIcon />}
              variant="text"
            >
              Back
            </Button>
            <Box sx={{ flex: 1 }} />
          </Stack>

          <Divider sx={{ my: 2 }} />

          {error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : null}

          <Box component="form" onSubmit={onSubmit}>
            <Stack spacing={2}>
              <TextField
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                type="email"
              />
              <TextField
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                type="password"
                helperText="至少 6 位"
              />
              <TextField
                label="Slug (username)"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
                helperText="5+ chars, letters/numbers, may include - _"
              />
              <TextField
                label="Avatar URL"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
              />
              <TextField
                label="Bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                multiline
                minRows={3}
              />

              <Box>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SaveIcon />}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating…" : "Create"}
                </Button>
              </Box>
              <Typography variant="caption" color="text.secondary">
                注意：这里是 Admin 创建用户，不需要验证码；后端会自动做 slug
                校验、email/slug 唯一性校验并哈希密码。
              </Typography>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Page>
  );
}

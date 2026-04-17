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
import { unitMutations } from "@rezics/api/unit/unit.mutations";
import { userQueries } from "@rezics/api/user/user.queries";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import React from "react";

import { Page } from "@/core/layouts/Page";

export default function UnitCreatePage() {
  const navigate = useNavigate();
  const [error, setError] = React.useState<string | null>(null);

  const meQuery = useQuery(userQueries.me());
  const myUnitId = meQuery.data?.unitId ?? "";

  const [userId, setUserId] = React.useState("");
  const [type, setType] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [defaultLanguage, setDefaultLanguage] = React.useState("en");
  const [translationTitle, setTranslationTitle] = React.useState("");
  const [translationSummary, setTranslationSummary] = React.useState("");

  React.useEffect(() => {
    if (userId) return;
    if (myUnitId) setUserId(myUnitId);
  }, [myUnitId, userId]);

  const createMutation = unitMutations.useCreate({
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Create failed"),
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const translations =
      translationTitle.trim() || translationSummary.trim()
        ? [
            {
              language: defaultLanguage.trim() || "en",
              title: translationTitle.trim() || undefined,
              summary: translationSummary.trim() || undefined,
            },
          ]
        : undefined;
    const unit = await createMutation.mutateAsync({
      userId: userId.trim(),
      type: type.trim(),
      status: status.trim() || undefined,
      defaultLanguage: defaultLanguage.trim() || undefined,
      translations,
    } as any);
    await navigate({ to: `/units/${(unit as any).id}`, replace: true });
  }

  return (
    <Page title="Create Unit" description="创建一个新 Unit（Admin）">
      <Card>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Button
              component={Link}
              to="/units"
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
                label="User ID"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                helperText="后端当前实现会强制用当前登录用户覆盖该字段（后续可按需改为 admin 可指定）。"
                required
              />
              <TextField
                label="Type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                required
                placeholder="BOOK / POST / TAG / REALM / SHELF / ..."
              />
              <TextField
                label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                placeholder="DRAFT / PUBLISHED / ARCHIVED / ..."
              />
              <TextField
                label="Default Language"
                value={defaultLanguage}
                onChange={(e) => setDefaultLanguage(e.target.value)}
                placeholder="en"
                helperText="ISO language code for the primary translation"
              />

              <Divider />
              <Typography variant="subtitle2" color="text.secondary">
                Initial Translation
              </Typography>
              <TextField
                label="Title"
                value={translationTitle}
                onChange={(e) => setTranslationTitle(e.target.value)}
                helperText="Title for the initial translation (uses default language)"
              />
              <TextField
                label="Summary"
                value={translationSummary}
                onChange={(e) => setTranslationSummary(e.target.value)}
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
                Tip：列表页支持翻页；创建成功会跳转到编辑页。
              </Typography>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Page>
  );
}

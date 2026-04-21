import { Box, Button, Stack, Typography } from "@mui/material";
import { postThreadQuery } from "@rezics/api/post/post";
import { EmptyState } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useTranslation } from "react-i18next";
import { PostTreeSection, ReplyComposer } from "@/post";
import { useAuth } from "@/user/pages/useAuth";
import { useAuthModal } from "@/user/components/useAuthModal";

interface ShelfDiscussionSectionProps {
  shelfUnitId: string;
  maxDepth?: number;
}

export const ShelfDiscussionSection: React.FC<ShelfDiscussionSectionProps> = ({
  shelfUnitId,
  maxDepth = 5,
}) => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const auth = useAuthModal("login");

  const { data } = useQuery(
    postThreadQuery(shelfUnitId, { mode: "threaded", maxDepth }),
  );
  const posts = data?.posts ?? [];
  const isEmpty = posts.length === 0;

  return (
    <Stack spacing={2}>
      {isAuthenticated ? (
        <ReplyComposer
          mode="progressive"
          targetUnitId={shelfUnitId}
          placeholder={t("shelf.discussion.composer.placeholder")}
        />
      ) : (
        <Box
          sx={{
            p: 2,
            borderRadius: 1,
            backgroundColor: "action.hover",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {t("shelf.discussion.signInPrompt")}
          </Typography>
          <Button
            size="small"
            variant="contained"
            disableElevation
            onClick={auth.openLogin}
          >
            {t("auth.login")}
          </Button>
          {auth.AuthModal({})}
        </Box>
      )}

      {isEmpty ? (
        <EmptyState title={t("shelf.discussion.empty.title")} />
      ) : (
        <PostTreeSection rootPostUnitId={shelfUnitId} maxDepth={maxDepth} />
      )}
    </Stack>
  );
};

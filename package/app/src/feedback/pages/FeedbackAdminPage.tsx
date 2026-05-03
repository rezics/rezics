import {
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { feedbackListQuery } from "@rezics/api/feedback/feedback.queries";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import FeedbackDrawer from "../components/FeedbackDrawer";
import FeedbackList from "../components/FeedbackList";

export const FeedbackAdminPage: React.FC = () => {
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<"all" | "mine" | "user">("all");
  const [userId, setUserId] = React.useState<string>("");
  const [search, setSearch] = React.useState<string>("");
  const [resolvedFilter, setResolvedFilter] = React.useState<
    "all" | "resolved" | "unresolved"
  >("all");

  const resolvedValue =
    resolvedFilter === "all" ? undefined : resolvedFilter === "resolved";

  // Prefetch general list for smoother UX
  useQuery(feedbackListQuery());

  return (
    <Box className="max-w-8xl mx-auto p-4">
      <Stack
        direction={{ xs: "column", sm: "row" }}
        className="items-center justify-between mb-8 gap-4"
      >
        <Typography variant="h5" className="font-bold">
          反馈管理
        </Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>
          新建反馈
        </Button>
      </Stack>

      <div className="pb-4">
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField
            label="搜索内容"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
            size="small"
            placeholder="搜索反馈内容..."
          />

          <TextField
            label="状态"
            select
            value={resolvedFilter}
            onChange={(e) =>
              setResolvedFilter(
                e.target.value as "all" | "resolved" | "unresolved",
              )
            }
            className="w-32"
            size="small"
          >
            <MenuItem value="all">全部</MenuItem>
            <MenuItem value="unresolved">待处理</MenuItem>
            <MenuItem value="resolved">已解决</MenuItem>
          </TextField>

          <Stack direction="row" spacing={2} className="min-w-[300px]">
            <TextField
              label="视图"
              select
              value={type}
              onChange={(e) =>
                setType(e.target.value as "all" | "mine" | "user")
              }
              className="w-32"
              size="small"
            >
              <MenuItem value="all">全部</MenuItem>
              <MenuItem value="mine">我的</MenuItem>
              <MenuItem value="user">按用户</MenuItem>
            </TextField>

            {type === "user" && (
              <TextField
                label="用户ID"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="输入用户ID"
                className="flex-1"
                size="small"
              />
            )}
          </Stack>
        </Stack>
      </div>

      <FeedbackList
        queryType={type}
        userId={userId || undefined}
        search={search}
        resolved={resolvedValue}
      />

      <FeedbackDrawer open={open} onClose={() => setOpen(false)} />
    </Box>
  );
};

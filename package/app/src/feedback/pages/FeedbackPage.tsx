import {
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import React from "react";
import FeedbackDrawer from "../components/FeedbackDrawer";
import FeedbackList from "../components/FeedbackList";

export const FeedbackPage: React.FC = () => {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [resolvedFilter, setResolvedFilter] = React.useState<
    "all" | "resolved" | "unresolved"
  >("all");

  const resolvedValue =
    resolvedFilter === "all" ? undefined : resolvedFilter === "resolved";

  return (
    <Box className="max-w-5xl mx-auto p-4">
      <Stack direction="row" className="items-center justify-between mb-4">
        <Typography variant="h5">我的反馈</Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>
          提交反馈
        </Button>
      </Stack>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        className="mb-4"
      >
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
          className="w-40"
          size="small"
        >
          <MenuItem value="all">全部</MenuItem>
          <MenuItem value="unresolved">待处理</MenuItem>
          <MenuItem value="resolved">已解决</MenuItem>
        </TextField>
      </Stack>

      <FeedbackList queryType="mine" search={search} resolved={resolvedValue} />

      <FeedbackDrawer open={open} onClose={() => setOpen(false)} />
    </Box>
  );
};

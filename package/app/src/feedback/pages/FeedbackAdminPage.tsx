import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
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
    <div className="max-w-8xl mx-auto p-4">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
        <h1 className="text-xl font-bold">反馈管理</h1>
        <Button onClick={() => setOpen(true)}>新建反馈</Button>
      </div>

      <div className="pb-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex flex-col gap-1 flex-1">
            <Label htmlFor="admin-feedback-search">搜索内容</Label>
            <Input
              id="admin-feedback-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索反馈内容..."
            />
          </div>

          <div className="flex flex-col gap-1 w-32">
            <Label htmlFor="admin-feedback-resolved">状态</Label>
            <Select
              value={resolvedFilter}
              onValueChange={(v) =>
                setResolvedFilter(v as "all" | "resolved" | "unresolved")
              }
            >
              <SelectTrigger id="admin-feedback-resolved">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="unresolved">待处理</SelectItem>
                <SelectItem value="resolved">已解决</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-row gap-4 min-w-[300px]">
            <div className="flex flex-col gap-1 w-32">
              <Label htmlFor="admin-feedback-view">视图</Label>
              <Select
                value={type}
                onValueChange={(v) =>
                  setType(v as "all" | "mine" | "user")
                }
              >
                <SelectTrigger id="admin-feedback-view">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="mine">我的</SelectItem>
                  <SelectItem value="user">按用户</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {type === "user" && (
              <div className="flex flex-col gap-1 flex-1">
                <Label htmlFor="admin-feedback-user-id">用户ID</Label>
                <Input
                  id="admin-feedback-user-id"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="输入用户ID"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <FeedbackList
        queryType={type}
        userId={userId || undefined}
        search={search}
        resolved={resolvedValue}
      />

      <FeedbackDrawer open={open} onClose={() => setOpen(false)} />
    </div>
  );
};

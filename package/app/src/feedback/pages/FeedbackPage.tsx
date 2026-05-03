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
    <div className="max-w-5xl mx-auto p-4">
      <div className="flex flex-row items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">我的反馈</h1>
        <Button onClick={() => setOpen(true)}>提交反馈</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="flex flex-col gap-1 flex-1">
          <Label htmlFor="feedback-search">搜索内容</Label>
          <Input
            id="feedback-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索反馈内容..."
          />
        </div>

        <div className="flex flex-col gap-1 w-40">
          <Label htmlFor="feedback-resolved">状态</Label>
          <Select
            value={resolvedFilter}
            onValueChange={(v) =>
              setResolvedFilter(v as "all" | "resolved" | "unresolved")
            }
          >
            <SelectTrigger id="feedback-resolved">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="unresolved">待处理</SelectItem>
              <SelectItem value="resolved">已解决</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <FeedbackList queryType="mine" search={search} resolved={resolvedValue} />

      <FeedbackDrawer open={open} onClose={() => setOpen(false)} />
    </div>
  );
};

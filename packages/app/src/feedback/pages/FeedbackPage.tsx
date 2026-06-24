/**
 * User feedback page for submitting and viewing personal feedback.
 * 用户反馈页面，用于提交和查看个人反馈。
 *
 * Header with title and submit button, followed by search/filter controls and feedback list.
 * 包含标题和提交按钮的头部，后面是搜索/过滤控制和反馈列表。
 *
 * Mobile (<640px):
 * +------40px-----+
 * | Title         |  flex-row justify-between
 * | [Submit]      |  mb-4 spacing
 * |               |
 * | Search Input  |  flex-col gap-4
 * |               |  flex-1 width
 * | Status (full) |
 * |               |
 * | Feedback List |  gap-1 label-input
 * +---------------+
 *
 * Tablet (640-1023px):
 * +-------60px-------+
 * | Title   [Submit] |  flex-col sm:flex-row
 * |                  |  max-w-5xl mx-auto
 * | Search  Status   |  gap-4 controls
 * |                  |  p-4 padding
 * | Feedback List    |
 * +------------------+
 *
 * Desktop (1024-1535px):
 * +-------80px-------+
 * |  Title [Submit]  |  max-w-5xl centered
 * |                  |  flex-row gap-4
 * | Search   Status  |
 * |                  |
 * | Feedback List    |  flex-col gap-1
 * +------------------+
 *
 * Ultra-wide (>=1536px):
 * +----------100px-----------+
 * |   Title        [Submit]  |  max-w-5xl constraint
 * |                          |  p-4 consistent padding
 * |  Search  Status  [Filter]|
 * |                          |
 * |   Feedback List Content  |
 * +------------------------+
 */

import { useTranslation } from "@rezics/i18n/react";
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
import { FeedbackDrawer } from "../components/FeedbackDrawer";
import { FeedbackList } from "../components/FeedbackList";
import { useRequireAuth } from "@/user/pages/useAuth";

export const FeedbackPage: React.FC = () => {
  useRequireAuth();
  const { t } = useTranslation(["common", "community", "search"]);
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [resolvedFilter, setResolvedFilter] = React.useState<
    "all" | "resolved" | "unresolved"
  >("all");

  const resolvedValue =
    resolvedFilter === "all" ? undefined : resolvedFilter === "resolved";

  const resolvedFilterLabel = {
    all: t("search:category_all"),
    unresolved: t("community:feedback_status_unresolved"),
    resolved: t("community:feedback_status_resolved"),
  }[resolvedFilter];

  return (
    <div className="w-full max-w-5xl mx-auto p-4">
      <div className="flex flex-row items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">
          {t("community:feedback_my_title")}
        </h1>
        <Button onClick={() => setOpen(true)}>
          {t("community:feedback_submit")}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="flex flex-col gap-1 flex-1">
          <Label htmlFor="feedback-search">
            {t("community:feedback_search_label")}
          </Label>
          <Input
            id="feedback-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("community:feedback_search_placeholder")}
          />
        </div>

        <div className="flex flex-col gap-1 w-40">
          <Label htmlFor="feedback-resolved">{t("common:status")}</Label>
          <Select
            value={resolvedFilter}
            onValueChange={(v) =>
              setResolvedFilter(v as "all" | "resolved" | "unresolved")
            }
          >
            <SelectTrigger id="feedback-resolved">
              <SelectValue>{resolvedFilterLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("search:category_all")}</SelectItem>
              <SelectItem value="unresolved">
                {t("community:feedback_status_unresolved")}
              </SelectItem>
              <SelectItem value="resolved">
                {t("community:feedback_status_resolved")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <FeedbackList queryType="mine" search={search} resolved={resolvedValue} />

      <FeedbackDrawer open={open} onClose={() => setOpen(false)} />
    </div>
  );
};

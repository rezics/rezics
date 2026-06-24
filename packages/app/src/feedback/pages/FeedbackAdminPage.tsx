/**
 * Admin feedback page for managing all feedback with advanced filtering.
 * 管理员反馈页面，用于管理所有反馈并进行高级过滤。
 *
 * Header with title and create button, followed by filter controls (search, status, type, user ID) and list.
 * 包含标题和创建按钮的头部，后面是过滤控制（搜索、状态、类型、用户 ID）和列表。
 *
 * Mobile (<640px):
 * +------40px-----+
 * | Title         |  flex-col sm:flex-row
 * | [New]         |  mb-8 gap-4 responsive
 * |               |
 * | Search        |  flex-col md:flex-row
 * |               |  pb-4 spacing
 * | Status        |  gap-4 controls
 * |               |
 * | View Selector |  min-w-[300px] flex-row
 * | User ID Input |  (conditional)
 * |               |
 * | Feedback List |  flex-col gap-1
 * +---------------+
 *
 * Tablet (640-1023px):
 * +-------60px-------+
 * | Title   [New]    |  flex-col md:flex-row
 * |                  |  max-w-8xl mx-auto
 * | Search | Status  |  items-center justify
 * | View | User ID   |
 * |                  |
 * | Feedback List    |  p-4 padding
 * +------------------+
 *
 * Desktop (1024-1535px):
 * +-------80px-------+
 * |  Title    [New]  |  max-w-8xl centered
 * |                  |  flex-col md:flex-row
 * | Search   Status  |  gap-4 compact layout
 * | View      User   |
 * |                  |
 * | Feedback List    |
 * +------------------+
 *
 * Ultra-wide (>=1536px):
 * +----------100px-----------+
 * |    Title           [New] |  max-w-8xl constraint
 * |                          |  mb-8 py-4 padding
 * | Search  Status  View User |
 * |      (all in row)        |
 * |                          |
 * |   Complete Feedback List |
 * +------------------------+
 */

import { feedbackListQuery } from "@rezics/contract/api/feedback/feedback.queries";
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
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { UserSearchField } from "@/shared/ui/UserSearchField";
import { FeedbackDrawer } from "../components/FeedbackDrawer";
import { FeedbackList } from "../components/FeedbackList";

export const FeedbackAdminPage: React.FC = () => {
  const { t } = useTranslation(["common", "community", "search", "settings"]);
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<"all" | "mine" | "user">("all");
  const [userId, setUserId] = React.useState<string>("");
  const [search, setSearch] = React.useState<string>("");
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

  const typeLabel = {
    all: t("search:category_all"),
    mine: t("community:feedback_view_mine"),
    user: t("community:feedback_view_user"),
  }[type];

  // Prefetch general list for smoother UX
  // 预取通用列表以获得更流畅的 UX
  useQuery(feedbackListQuery());

  return (
    <div className="w-full max-w-8xl mx-auto p-4">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
        <h1 className="text-xl font-bold">
          {t("community:feedback_admin_title")}
        </h1>
        <Button onClick={() => setOpen(true)}>
          {t("community:feedback_new")}
        </Button>
      </div>

      <div className="pb-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex flex-col gap-1 flex-1">
            <Label htmlFor="admin-feedback-search">
              {t("community:feedback_search_label")}
            </Label>
            <Input
              id="admin-feedback-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("community:feedback_search_placeholder")}
            />
          </div>

          <div className="flex flex-col gap-1 w-32">
            <Label htmlFor="admin-feedback-resolved">
              {t("common:status")}
            </Label>
            <Select
              value={resolvedFilter}
              onValueChange={(v) =>
                setResolvedFilter(v as "all" | "resolved" | "unresolved")
              }
            >
              <SelectTrigger id="admin-feedback-resolved">
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

          <div className="flex flex-row gap-4 min-w-[300px]">
            <div className="flex flex-col gap-1 w-32">
              <Label htmlFor="admin-feedback-view">{t("common:view")}</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as "all" | "mine" | "user")}
              >
                <SelectTrigger id="admin-feedback-view">
                  <SelectValue>{typeLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("search:category_all")}
                  </SelectItem>
                  <SelectItem value="mine">
                    {t("community:feedback_view_mine")}
                  </SelectItem>
                  <SelectItem value="user">
                    {t("community:feedback_view_user")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {type === "user" && (
              <div className="flex flex-1 flex-col gap-1">
                <UserSearchField
                  id="admin-feedback-user-id"
                  value={userId}
                  onChange={setUserId}
                  label={t("settings:user_id_label")}
                  placeholder={t("community:feedback_user_id_placeholder")}
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

import { feedbackListQuery } from "@rezics/api/feedback/feedback.queries";
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

  // Prefetch general list for smoother UX
  // 预取通用列表以获得更流畅的 UX
  useQuery(feedbackListQuery());

  return (
    <div className="max-w-8xl mx-auto p-4">
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
                <SelectValue />
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
                  <SelectValue />
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
              <div className="flex flex-col gap-1 flex-1">
                <Label htmlFor="admin-feedback-user-id">
                  {t("settings:user_id_label")}
                </Label>
                <Input
                  id="admin-feedback-user-id"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
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

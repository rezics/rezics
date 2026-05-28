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
import FeedbackDrawer from "../components/FeedbackDrawer";
import FeedbackList from "../components/FeedbackList";

export const FeedbackPage: React.FC = () => {
  const { t } = useTranslation(["common", "community", "search"]);
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
        <h1 className="text-xl font-semibold">{t("community:feedback_my_title")}</h1>
        <Button onClick={() => setOpen(true)}>{t("community:feedback_submit")}</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="flex flex-col gap-1 flex-1">
          <Label htmlFor="feedback-search">{t("community:feedback_search_label")}</Label>
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
      </div>

      <FeedbackList queryType="mine" search={search} resolved={resolvedValue} />

      <FeedbackDrawer open={open} onClose={() => setOpen(false)} />
    </div>
  );
};

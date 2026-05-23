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
import * as m from "@rezics/i18n/messages";
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
        <h1 className="text-xl font-semibold">{m.feedback_my_title()}</h1>
        <Button onClick={() => setOpen(true)}>{m.feedback_submit()}</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="flex flex-col gap-1 flex-1">
          <Label htmlFor="feedback-search">{m.feedback_search_label()}</Label>
          <Input
            id="feedback-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={m.feedback_search_placeholder()}
          />
        </div>

        <div className="flex flex-col gap-1 w-40">
          <Label htmlFor="feedback-resolved">{m.common_status()}</Label>
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
              <SelectItem value="all">{m.search_category_all()}</SelectItem>
              <SelectItem value="unresolved">
                {m.feedback_status_unresolved()}
              </SelectItem>
              <SelectItem value="resolved">
                {m.feedback_status_resolved()}
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

"use client";

import { createListCollection } from "@ark-ui/react/select";
import { type FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { useT } from "@/lib/i18n/locale";

/**
 * Mobile (<640px):
 * +-------------------------------+
 * | Library                       |
 * | Configure how your library... |
 * |-------------------------------|
 * | [Card: Display]               |
 * | Default View  [select       ] |
 * | Sort By       [select       ] |
 * |-------------------------------|
 * | [Card: Visibility]            |
 * | Show Ratings     [switch    ] |
 * | Show Progress    [switch    ] |
 * |              [Save          ] |
 * +-------------------------------+
 * Select/Switch 控件 full-width 堆叠。
 *
 * Tablet (640-1023px):
 * 与 Mobile 一致。
 *
 * Desktop (1024-1535px):
 * 受 settings layout flex-1 约束，
 * 卡片 w-full。
 *
 * Ultra-wide (>=1536px):
 * 与 Desktop 一致。
 */
export function SettingsLibraryContent({
  initialDefaultView = "grid",
  initialShowProgress = true,
  initialShowRatings = true,
  initialSortBy = "date-added",
}: {
  readonly initialDefaultView?: string;
  readonly initialShowProgress?: boolean;
  readonly initialShowRatings?: boolean;
  readonly initialSortBy?: string;
} = {}) {
  const [t] = useT();
  const [defaultView, setDefaultView] = useState([initialDefaultView]);
  const [sortBy, setSortBy] = useState([initialSortBy]);
  const [showRatings, setShowRatings] = useState(initialShowRatings);
  const [showProgress, setShowProgress] = useState(initialShowProgress);
  const [saving, setSaving] = useState(false);

  const viewCollection = useMemo(
    () =>
      createListCollection({
        items: [
          { label: t.settings.viewGrid, value: "grid" },
          { label: t.settings.viewList, value: "list" },
        ],
      }),
    [t],
  );

  const sortCollection = useMemo(
    () =>
      createListCollection({
        items: [
          { label: t.settings.sortTitle, value: "title" },
          { label: t.settings.sortDateAdded, value: "date-added" },
          { label: t.settings.sortRating, value: "rating" },
        ],
      }),
    [t],
  );

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // Library preferences persistence via API in a future iteration
      // 书库偏好持久化将在后续迭代中通过 API 实现
      toast.success({ title: t.settings.saved });
    } catch {
      toast.error({ title: t.common.error });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">
          {t.settings.libraryPreferences}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t.settings.libraryDescription}
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSave}>
        <Card>
          <CardHeader title={t.settings.defaultView} />
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <span className="text-sm font-medium">
                {t.settings.defaultView}
              </span>
              <Select
                collection={viewCollection}
                onValueChange={(detail) => setDefaultView(detail.value)}
                value={defaultView}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t.settings.defaultView} />
                </SelectTrigger>
                <SelectContent>
                  {viewCollection.items.map((item) => (
                    <SelectItem item={item} key={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-medium">{t.settings.sortBy}</span>
              <Select
                collection={sortCollection}
                onValueChange={(detail) => setSortBy(detail.value)}
                value={sortBy}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t.settings.sortBy} />
                </SelectTrigger>
                <SelectContent>
                  {sortCollection.items.map((item) => (
                    <SelectItem item={item} key={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title={t.settings.libraryPreferences} />
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t.settings.showRatings}</p>
                <p className="text-muted-foreground text-xs">
                  {t.settings.showRatingsDescription}
                </p>
              </div>
              <Switch
                checked={showRatings}
                className="shrink-0"
                onCheckedChange={(detail) => setShowRatings(detail.checked)}
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t.settings.showProgress}</p>
                <p className="text-muted-foreground text-xs">
                  {t.settings.showProgressDescription}
                </p>
              </div>
              <Switch
                checked={showProgress}
                className="shrink-0"
                onCheckedChange={(detail) => setShowProgress(detail.checked)}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button isLoading={saving} type="submit">
              {t.common.save}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}

export default function SettingsLibraryPage() {
  return <SettingsLibraryContent />;
}

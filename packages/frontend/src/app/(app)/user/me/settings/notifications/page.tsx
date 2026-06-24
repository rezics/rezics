"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { useT } from "@/lib/i18n/locale";

/**
 * Mobile (<640px):
 * +-------------------------------+
 * | Notifications                 |
 * | Choose what notifications...  |
 * |-------------------------------|
 * | [Card: Delivery]              |
 * | Email notifs      [switch   ] |
 * | Push notifs       [switch   ] |
 * |-------------------------------|
 * | [Card: Activity]              |
 * | Post replies      [switch   ] |
 * | Mentions          [switch   ] |
 * | Realm updates     [switch   ] |
 * |              [Save          ] |
 * +-------------------------------+
 * Switch 行: flex row, label flex-1, switch shrink-0。
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
export function SettingsNotificationsContent({
  initialEmailNotifs = true,
  initialMentions = true,
  initialPostReplies = true,
  initialPushNotifs = false,
  initialRealmUpdates = true,
}: {
  readonly initialEmailNotifs?: boolean;
  readonly initialMentions?: boolean;
  readonly initialPostReplies?: boolean;
  readonly initialPushNotifs?: boolean;
  readonly initialRealmUpdates?: boolean;
} = {}) {
  const [t] = useT();
  const [emailNotifs, setEmailNotifs] = useState(initialEmailNotifs);
  const [pushNotifs, setPushNotifs] = useState(initialPushNotifs);
  const [postReplies, setPostReplies] = useState(initialPostReplies);
  const [mentions, setMentions] = useState(initialMentions);
  const [realmUpdates, setRealmUpdates] = useState(initialRealmUpdates);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // Notification preferences persistence via API in a future iteration
      // 通知偏好持久化将在后续迭代中通过 API 实现
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
        <h2 className="text-lg font-semibold">{t.settings.notifications}</h2>
        <p className="text-muted-foreground text-sm">
          {t.settings.notificationsDescription}
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSave}>
        <Card>
          <CardHeader title={t.settings.emailNotifications} />
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {t.settings.emailNotifications}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t.settings.emailNotificationsDescription}
                </p>
              </div>
              <Switch
                checked={emailNotifs}
                className="shrink-0"
                onCheckedChange={(detail) => setEmailNotifs(detail.checked)}
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {t.settings.pushNotifications}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t.settings.pushNotificationsDescription}
                </p>
              </div>
              <Switch
                checked={pushNotifs}
                className="shrink-0"
                onCheckedChange={(detail) => setPushNotifs(detail.checked)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title={t.settings.notifications} />
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t.settings.postReplies}</p>
                <p className="text-muted-foreground text-xs">
                  {t.settings.postRepliesDescription}
                </p>
              </div>
              <Switch
                checked={postReplies}
                className="shrink-0"
                onCheckedChange={(detail) => setPostReplies(detail.checked)}
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t.settings.mentions}</p>
                <p className="text-muted-foreground text-xs">
                  {t.settings.mentionsDescription}
                </p>
              </div>
              <Switch
                checked={mentions}
                className="shrink-0"
                onCheckedChange={(detail) => setMentions(detail.checked)}
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t.settings.realmUpdates}</p>
                <p className="text-muted-foreground text-xs">
                  {t.settings.realmUpdatesDescription}
                </p>
              </div>
              <Switch
                checked={realmUpdates}
                className="shrink-0"
                onCheckedChange={(detail) => setRealmUpdates(detail.checked)}
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

export default function SettingsNotificationsPage() {
  return <SettingsNotificationsContent />;
}

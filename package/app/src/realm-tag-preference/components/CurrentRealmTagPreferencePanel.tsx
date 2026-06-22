import type { UserSettings } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@rezics/ui/shadcn";
import { PlusIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSaveRealmTagPreferences } from "../hooks/useSaveRealmTagPreferences";
import {
  createRealmTagPreferenceDraft,
  pruneEmptyRealmTagPreferenceDraft,
  setRealmForTarget,
} from "../models/realmTagPreferenceDraft";
import {
  REALM_TAG_DISPLAY_TARGETS,
  realmTagDisplayTargetLabel,
} from "../models/realmTagPreferenceTargets";

export interface CurrentRealmTagPreferencePanelProps {
  realmId: string;
  settings?: UserSettings | null;
}

/**
 * 當前 realm 的 catalog tag 顯示開關面板。它只能修改目前 realm 是否出現在每個
 * catalog target 中；完整搜尋、排序與 max display 編輯留在帳號偏好頁。
 *
 * Mobile (<640px):
 * +--------------------+
 * | Realm tag display  |
 * | [Books x] [Add][Save]|
 * +--------------------+
 *
 * Tablet (640-1023px):
 * +----------------------------+
 * | Realm tag display          |
 * | [Books x] [Media x] [Add][Save]|
 * +----------------------------+
 *
 * Desktop (1024-1535px):
 * +--------------------------------+
 * | Realm tag display              |
 * | [Books x] [Games x] [Add][Save]|
 * +--------------------------------+
 *
 * Ultra-wide (>=1536px):
 * +--------------------------------------+
 * | Realm tag display                    |
 * | [Books x] [Games x] [Media x] [Add][Save]|
 * +--------------------------------------+
 *
 * 同行 badge、add button 與 save button 都是 h-8 shrink-0；窄寬度時
 * flex-wrap 換行，長 label 由 badge 內 min-w-0 truncate 截斷；寬螢幕
 * 留白落在 row 右側。
 */
export function CurrentRealmTagPreferencePanel({
  realmId,
  settings,
}: CurrentRealmTagPreferencePanelProps) {
  const { t } = useTranslation(["common", "settings"]);
  const initialDraft = useMemo(
    () => createRealmTagPreferenceDraft(settings),
    [settings],
  );
  const [draft, setDraft] = useState(initialDraft);
  useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft]);
  const save = useSaveRealmTagPreferences({
    onSuccess: () => toast.success(t("settings:realm_tag_preference_saved")),
  });

  const handleSave = () => {
    save.saveRealmTagPreferences(pruneEmptyRealmTagPreferenceDraft(draft));
  };
  const selectedTargets = REALM_TAG_DISPLAY_TARGETS.filter((target) =>
    draft[target].realmIds.includes(realmId),
  );
  const allTargetsSelected =
    selectedTargets.length === REALM_TAG_DISPLAY_TARGETS.length;

  return (
    <section className="flex min-w-0 flex-col gap-4 p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium leading-ui">
          {t("settings:realm_tag_preference_current_title")}
        </h3>
        <p className="text-sm leading-ui text-text-secondary">
          {t("settings:realm_tag_preference_current_description")}
        </p>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {selectedTargets.map((target) => {
          const label = realmTagDisplayTargetLabel(t, target);
          return (
            <Badge
              key={target}
              variant="secondary"
              className="h-8 max-w-full min-w-0 rounded-md px-3 text-sm leading-ui"
            >
              <span className="min-w-0 truncate">{label}</span>
              <button
                type="button"
                className="-mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
                disabled={save.isPending}
                onClick={() =>
                  setDraft((current) =>
                    setRealmForTarget(current, target, realmId, false),
                  )
                }
                aria-label={t("settings:realm_tag_preference_remove_target", {
                  target: label,
                })}
              >
                <XIcon className="h-3 w-3" />
              </button>
            </Badge>
          );
        })}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 rounded-md"
                disabled={save.isPending || allTargetsSelected}
              />
            }
          >
            <PlusIcon className="h-4 w-4" />
            {t("common:add")}
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48">
            {REALM_TAG_DISPLAY_TARGETS.map((target) => {
              const checked = draft[target].realmIds.includes(realmId);
              return (
                <DropdownMenuCheckboxItem
                  key={target}
                  checked={checked}
                  disabled={save.isPending}
                  onCheckedChange={(next) =>
                    setDraft((current) =>
                      setRealmForTarget(
                        current,
                        target,
                        realmId,
                        next === true,
                      ),
                    )
                  }
                >
                  {realmTagDisplayTargetLabel(t, target)}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          size="sm"
          className="h-8 rounded-md"
          onClick={handleSave}
          disabled={save.isPending}
        >
          {t("common:save")}
        </Button>
      </div>
    </section>
  );
}

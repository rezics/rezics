import type {
  MeiliKey,
  MeiliKeyListResponse,
} from "@rezics/api/meili/meili.admin.queries";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@rezics/ui/shadcn";
import { Spinner } from "@rezics/ui";
import { useMessage } from "@rezics/i18n/react";
import {
  admin_meili_create_admin_key,
  admin_meili_creating,
  admin_meili_existing_keys_title,
  admin_meili_key_management_description,
  admin_meili_key_management_title,
  admin_meili_latest_admin_key,
  admin_meili_loading_keys,
  admin_meili_no_keys_found,
  admin_meili_refresh_key_list,
  common_action,
  common_actions,
  common_delete,
  common_expires,
  common_indexes,
  common_name,
  common_never,
  common_uid,
} from "@rezics/i18n/messages";
const m = {
  admin_meili_create_admin_key,
  admin_meili_creating,
  admin_meili_existing_keys_title,
  admin_meili_key_management_description,
  admin_meili_key_management_title,
  admin_meili_latest_admin_key,
  admin_meili_loading_keys,
  admin_meili_no_keys_found,
  admin_meili_refresh_key_list,
  common_action,
  common_actions,
  common_delete,
  common_expires,
  common_indexes,
  common_name,
  common_never,
  common_uid,
};

const i18nMessages = {
  admin_meili_create_admin_key,
  admin_meili_creating,
  admin_meili_existing_keys_title,
  admin_meili_key_management_description,
  admin_meili_key_management_title,
  admin_meili_latest_admin_key,
  admin_meili_loading_keys,
  admin_meili_no_keys_found,
  admin_meili_refresh_key_list,
  common_action,
  common_actions,
  common_delete,
  common_expires,
  common_indexes,
  common_name,
  common_never,
  common_uid,
};

export function MeiliKeyManagementSection({
  keyList,
  lastAdminKey,
  isKeysLoading,
  isCreating,
  isDeleting,
  onCreateAdminKey,
  onRefreshKeys,
  onDeleteKey,
}: {
  keyList?: MeiliKeyListResponse;
  lastAdminKey: string | null;
  isKeysLoading: boolean;
  isCreating: boolean;
  isDeleting: boolean;
  onCreateAdminKey: () => void;
  onRefreshKeys: () => void;
  onDeleteKey: (key: MeiliKey) => void;
}) {
  const m = useMessage(i18nMessages);
  return (
    <Card className="border-border-whisper bg-surface-base">
      <CardHeader>
        <CardTitle>{m.admin_meili_key_management_title()}</CardTitle>
        <CardDescription>
          {m.admin_meili_key_management_description()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-warning-text"
            onClick={onCreateAdminKey}
            disabled={isCreating}
          >
            {isCreating
              ? m.admin_meili_creating()
              : m.admin_meili_create_admin_key()}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefreshKeys}
            disabled={isKeysLoading}
          >
            {m.admin_meili_refresh_key_list()}
          </Button>
        </div>

        {lastAdminKey ? (
          <div className="space-y-1 break-all text-xs">
            <div className="font-semibold text-warning-text">
              {m.admin_meili_latest_admin_key()}
            </div>
            <code className="rounded bg-surface-elevated px-2 py-1">
              {lastAdminKey}
            </code>
          </div>
        ) : null}

        <div className="border-t border-border-whisper pt-3">
          <p className="mb-2 text-sm font-semibold leading-[1.4]">
            {m.admin_meili_existing_keys_title()}
          </p>
          {isKeysLoading ? (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Spinner size="sm" />
              <span>{m.admin_meili_loading_keys()}</span>
            </div>
          ) : !keyList || keyList.results.length === 0 ? (
            <p className="text-sm text-text-secondary">
              {m.admin_meili_no_keys_found()}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-border-whisper text-text-secondary">
                  <tr>
                    <th className="py-1 pr-3">{m.common_uid()}</th>
                    <th className="py-1 pr-3">{m.common_name()}</th>
                    <th className="py-1 pr-3">{m.common_actions()}</th>
                    <th className="py-1 pr-3">{m.common_indexes()}</th>
                    <th className="py-1 pr-3">{m.common_expires()}</th>
                    <th className="py-1 pr-3">{m.common_action()}</th>
                  </tr>
                </thead>
                <tbody>
                  {keyList.results.map((key) => (
                    <tr
                      key={key.uid}
                      className="border-b border-border-whisper"
                    >
                      <td className="py-1 pr-3 align-top font-mono text-xs">
                        {key.uid}
                      </td>
                      <td className="py-1 pr-3 align-top text-xs">
                        {key.name || "-"}
                      </td>
                      <td className="py-1 pr-3 align-top text-xs">
                        {(key.actions || []).join(", ") || "-"}
                      </td>
                      <td className="py-1 pr-3 align-top text-xs">
                        {(key.indexes || []).join(", ") || "-"}
                      </td>
                      <td className="py-1 pr-3 align-top text-xs">
                        {key.expiresAt || m.common_never()}
                      </td>
                      <td className="py-1 pr-3 align-top">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-error-text"
                          onClick={() => onDeleteKey(key)}
                          disabled={isDeleting}
                        >
                          {m.common_delete()}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

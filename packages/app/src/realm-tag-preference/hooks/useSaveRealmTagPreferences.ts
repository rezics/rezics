import { useUpdateSettingsMutation } from "@rezics/contract/api/user/user.mutations";
import type { RealmTagPreferences, UserSettings } from "@rezics/contract";

/**
 * 保存 realm tag display preferences 的小型封装，讓帳號設定頁與 realm 詳情
 * dialog 共用同一個 settings mutation，而不互相引用彼此的 feature code。
 */
export function useSaveRealmTagPreferences(options?: {
  onSuccess?: (settings: UserSettings) => void;
  onError?: (error: Error) => void;
}) {
  const mutation = useUpdateSettingsMutation({
    onSuccess: (settings) => options?.onSuccess?.(settings),
    onError: (error) => options?.onError?.(error),
  });

  return {
    ...mutation,
    saveRealmTagPreferences: (realmTagPreferences: RealmTagPreferences) =>
      mutation.mutate({ realmTagPreferences }),
  };
}

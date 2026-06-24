import {
  useClearRealmExtraValueMutation,
  useSetRealmExtraValueMutation,
} from "@rezics/api/realm/realm-extra.mutations";
import type { RealmAvatarExtra, RealmBannerExtra } from "@rezics/contract";
import { getI18nRuntime } from "@rezics/i18n/runtime";
import { toast } from "sonner";
import { ImageUploadField } from "@/shared/ui/ImageUploadField";

type RealmImageExtraKey = "avatar" | "banner";

function RealmImagePicker({
  realmId,
  extraKey,
  label,
  savedMessage,
  value,
}: {
  realmId: string;
  extraKey: RealmImageExtraKey;
  label: string;
  savedMessage: string;
  value?: RealmBannerExtra | RealmAvatarExtra | null;
}) {
  const setExtraValue = useSetRealmExtraValueMutation();
  const clearValue = useClearRealmExtraValueMutation();

  const currentUrl = value?.kind === "url" ? value.url : null;

  const handleChange = async (url: string | null) => {
    try {
      if (url) {
        await setExtraValue.mutateAsync({
          realmId,
          key: extraKey,
          value: { kind: "url", url },
        });
      } else {
        await clearValue.mutateAsync({ realmId, key: extraKey });
      }
      toast.success(savedMessage);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
    }
  };

  return (
    <div className="rounded-md bg-surface-subtle p-4">
      <ImageUploadField
        value={currentUrl}
        onChange={(url) => void handleChange(url)}
        label={label}
      />
    </div>
  );
}

export function BannerPicker({
  realmId,
  value,
}: {
  realmId: string;
  value?: RealmBannerExtra | null;
}) {
  return (
    <RealmImagePicker
      realmId={realmId}
      extraKey="banner"
      label={getI18nRuntime().i18n.t("entity:realm_banner")}
      savedMessage={getI18nRuntime().i18n.t("entity:realm_banner_saved")}
      value={value}
    />
  );
}

export function AvatarPicker({
  realmId,
  value,
}: {
  realmId: string;
  value?: RealmAvatarExtra | null;
}) {
  return (
    <RealmImagePicker
      realmId={realmId}
      extraKey="avatar"
      label={getI18nRuntime().i18n.t("entity:realm_avatar")}
      savedMessage={getI18nRuntime().i18n.t("entity:realm_avatar_saved")}
      value={value}
    />
  );
}

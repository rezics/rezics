import { useTranslation } from "@rezics/i18n/react";
import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import {
  Plus as AddIcon,
  X as CloseIcon,
  Trash2 as DeleteIcon,
} from "lucide-react";
import type { FC } from "react";
import { useState } from "react";

interface ScopesEditorProps {
  scopes: Record<string, string[]>;
  onChange: (scopes: Record<string, string[]>) => void;
}

/**
 * 预定义的 scope 域和权限选项
 */
const PREDEFINED_DOMAINS = [
  "main",
  "book",
  "chapter",
  "user",
  "post",
  "tag",
  "realm",
  "shelf",
];
const PREDEFINED_PERMISSIONS = ["read", "write", "delete", "admin"];

/**
 * ScopesEditor - 编辑 API token 权限 (scopes) 的组件
 */
export const ScopesEditor: FC<ScopesEditorProps> = ({ scopes, onChange }) => {
  const { t } = useTranslation(["admin", "common"]);
const [newDomain, setNewDomain] = useState("");
  const [newPermission, setNewPermission] = useState("");
  const [customDomain, setCustomDomain] = useState("");

  const addScope = () => {
    const domain = newDomain === "custom" ? customDomain : newDomain;
    if (!domain || !newPermission) return;

    const updated = { ...scopes };
    if (!updated[domain]) {
      updated[domain] = [];
    }
    if (!updated[domain].includes(newPermission)) {
      updated[domain] = [...updated[domain], newPermission];
    }
    onChange(updated);
    setNewPermission("");
  };

  const removeScope = (domain: string, permission: string) => {
    const updated = { ...scopes };
    if (updated[domain]) {
      updated[domain] = updated[domain].filter((p) => p !== permission);
      if (updated[domain].length === 0) {
        delete updated[domain];
      }
    }
    onChange(updated);
  };

  const removeDomain = (domain: string) => {
    const updated = { ...scopes };
    delete updated[domain];
    onChange(updated);
  };

  return (
    <div>
      <p className="mb-2 font-medium text-sm">{t("admin:token_scopes_title")}</p>

      {/* 显示当前 scopes */}
      {Object.keys(scopes).length > 0 && (
        <div className="rounded-md border border-border-whisper p-3 mb-4">
          {Object.entries(scopes).map(([domain, permissions]) => (
            <div key={domain} className="mb-2">
              <div className="flex flex-row items-center gap-2">
                <span className="text-sm font-medium min-w-20">{domain}:</span>
                <div className="flex flex-row flex-wrap gap-1">
                  {permissions.map((perm) => (
                    <Badge
                      key={`${domain}:${perm}`}
                      className="bg-brand-fill text-white inline-flex items-center gap-1"
                    >
                      {perm}
                      <button
                        type="button"
                        aria-label={t("admin:token_remove_permission", {
                          permission: perm,
                        })}
                        onClick={() => removeScope(domain, perm)}
                        className="hover:opacity-80"
                      >
                        <CloseIcon className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-error-text size-8"
                  onClick={() => removeDomain(domain)}
                  aria-label={t("admin:token_remove_domain")}
                >
                  <DeleteIcon className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 添加新 scope */}
      <div className="flex flex-row gap-2 items-end flex-wrap">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">{t("admin:token_domain")}</Label>
          <Select
            value={newDomain}
            onValueChange={(value) => {
              if (value) setNewDomain(value);
            }}
          >
            <SelectTrigger size="sm" className="min-w-30">
              <SelectValue placeholder={t("admin:token_domain")} />
            </SelectTrigger>
            <SelectContent>
              {PREDEFINED_DOMAINS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
              <SelectItem value="custom">
                {t("admin:token_scope_custom")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {newDomain === "custom" && (
          <div className="flex flex-col gap-1">
            <Label className="text-xs">
              {t("admin:token_scope_custom_domain")}
            </Label>
            <Input
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              className="h-8"
            />
          </div>
        )}

        <div className="flex flex-col gap-1">
          <Label className="text-xs">{t("admin:token_permission")}</Label>
          <Select
            value={newPermission}
            onValueChange={(value) => {
              if (value) setNewPermission(value);
            }}
          >
            <SelectTrigger size="sm" className="min-w-30">
              <SelectValue placeholder={t("admin:token_permission")} />
            </SelectTrigger>
            <SelectContent>
              {PREDEFINED_PERMISSIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={addScope}
          disabled={
            !newDomain ||
            !newPermission ||
            (newDomain === "custom" && !customDomain)
          }
        >
          <AddIcon className="size-4" />
          {t("common:add")}
        </Button>
      </div>

      {Object.keys(scopes).length === 0 && (
        <p className="text-sm text-text-secondary mt-2">
          {t("admin:token_scopes_default_help")}
        </p>
      )}
    </div>
  );
};

export default ScopesEditor;

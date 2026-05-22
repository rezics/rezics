import { useCreateEntity } from "@rezics/api/entity";
import type {
  CreateEntityInput,
  CreditAttributionRole,
  EntityKind,
  SubjectAttributionRole,
} from "@rezics/contract";
import {
  CreationMode,
  creditAttributionRoleRegistry,
  creditAttributionRoles,
  entityKinds,
  subjectAttributionRoleRegistry,
  subjectAttributionRoles,
} from "@rezics/contract";
import { Button, Input, Label } from "@rezics/ui/shadcn";
import { type FormEvent, useMemo, useState } from "react";
import {
  suggestCreditEligibility,
  suggestSubjectEligibility,
} from "../models/eligibilitySuggestions";

interface EntityInlineCreateFormProps {
  initialTitle?: string;
  initialLanguage?: string;
  creationContext?: "catalog" | "personal";
  kindHint?: EntityKind;
  selectedCreditRole?: CreditAttributionRole;
  selectedSubjectRole?: SubjectAttributionRole;
  onCreated: (unitId: string) => void;
  onCancel?: () => void;
}

export function EntityInlineCreateForm({
  initialTitle = "",
  initialLanguage = "en",
  creationContext = "catalog",
  kindHint,
  selectedCreditRole,
  selectedSubjectRole,
  onCreated,
  onCancel,
}: EntityInlineCreateFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [language, setLanguage] = useState(initialLanguage);
  const [kind, setKind] = useState<EntityKind>(kindHint ?? entityKinds[0]);
  const [eligibleCreditRoles, setEligibleCreditRoles] = useState<
    CreditAttributionRole[]
  >(() =>
    suggestCreditEligibility(kindHint ?? entityKinds[0], selectedCreditRole),
  );
  const [eligibleSubjectRoles, setEligibleSubjectRoles] = useState<
    SubjectAttributionRole[]
  >(() =>
    suggestSubjectEligibility(kindHint ?? entityKinds[0], selectedSubjectRole),
  );
  const [avatar, setAvatar] = useState("");
  const [error, setError] = useState<string | null>(null);
  const availableCreditRoles = useMemo(
    () =>
      creditAttributionRoles.filter(
        (role) => !eligibleCreditRoles.includes(role),
      ),
    [eligibleCreditRoles],
  );
  const availableSubjectRoles = useMemo(
    () =>
      subjectAttributionRoles.filter(
        (role) => !eligibleSubjectRoles.includes(role),
      ),
    [eligibleSubjectRoles],
  );

  const mutation = useCreateEntity({
    onSuccess: (entity) => onCreated(entity.unitId),
    onError: (err) => setError(err.message || "Failed to create entity"),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required");
      return;
    }
    const trimmedLang = language.trim() || "en";
    const payload: CreateEntityInput = {
      kind,
      avatar: avatar.trim() || null,
      eligibleCreditRoles,
      eligibleSubjectRoles,
      creationMode:
        creationContext === "personal"
          ? CreationMode.PERSONAL
          : CreationMode.WIKI,
      translations: [{ language: trimmedLang, title: trimmedTitle }],
    };
    mutation.mutate(payload);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 border-t border-border-whisper p-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="entity-inline-title">Title</Label>
        <Input
          id="entity-inline-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Liu Cixin"
          autoFocus
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entity-inline-language">Language</Label>
          <Input
            id="entity-inline-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="en"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entity-inline-kind">Kind</Label>
          <select
            id="entity-inline-kind"
            value={kind}
            onChange={(e) => {
              const nextKind = e.target.value as EntityKind;
              setKind(nextKind);
              setEligibleCreditRoles(
                suggestCreditEligibility(nextKind, selectedCreditRole),
              );
              setEligibleSubjectRoles(
                suggestSubjectEligibility(nextKind, selectedSubjectRole),
              );
            }}
            className="h-9 rounded-md border border-border-whisper bg-surface-canvas px-2 text-sm text-text-primary"
          >
            {entityKinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="entity-inline-avatar">Avatar URL</Label>
        <Input
          id="entity-inline-avatar"
          value={avatar}
          onChange={(e) => setAvatar(e.target.value)}
          placeholder="https://cdn.example/entity.png"
        />
      </div>
      <EligibilityRoleEditor
        label="Credit eligibility"
        roles={eligibleCreditRoles}
        availableRoles={availableCreditRoles}
        getLabel={(role) => creditAttributionRoleRegistry[role].i18nKey}
        fallbackPrefix="attribution.credit.role"
        onAdd={(role) =>
          setEligibleCreditRoles((current) => [...current, role])
        }
        onRemove={(role) =>
          setEligibleCreditRoles((current) =>
            current.filter((item) => item !== role),
          )
        }
      />
      <EligibilityRoleEditor
        label="Subject eligibility"
        roles={eligibleSubjectRoles}
        availableRoles={availableSubjectRoles}
        getLabel={(role) => subjectAttributionRoleRegistry[role].i18nKey}
        fallbackPrefix="attribution.subject.role"
        onAdd={(role) =>
          setEligibleSubjectRoles((current) => [...current, role])
        }
        onRemove={(role) =>
          setEligibleSubjectRoles((current) =>
            current.filter((item) => item !== role),
          )
        }
      />
      {error ? <p className="text-xs text-text-error">{error}</p> : null}
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Creating…" : "Create"}
        </Button>
      </div>
    </form>
  );
}

interface EligibilityRoleEditorProps<Role extends string> {
  label: string;
  roles: readonly Role[];
  availableRoles: readonly Role[];
  getLabel: (role: Role) => string;
  fallbackPrefix: string;
  onAdd: (role: Role) => void;
  onRemove: (role: Role) => void;
}

function EligibilityRoleEditor<Role extends string>({
  label,
  roles,
  availableRoles,
  getLabel,
  fallbackPrefix,
  onAdd,
  onRemove,
}: EligibilityRoleEditorProps<Role>) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {roles.map((role) => (
          <Button
            key={role}
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onRemove(role)}
          >
            {getRoleText(getLabel(role), fallbackPrefix, role)}
          </Button>
        ))}
      </div>
      {availableRoles.length > 0 ? (
        <select
          value=""
          onChange={(e) => {
            if (!e.target.value) return;
            onAdd(e.target.value as Role);
            e.currentTarget.value = "";
          }}
          className="h-9 rounded-md border border-border-whisper bg-surface-canvas px-2 text-sm text-text-primary"
        >
          <option value="">Add role</option>
          {availableRoles.map((role) => (
            <option key={role} value={role}>
              {getRoleText(getLabel(role), fallbackPrefix, role)}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

function getRoleText(i18nKey: string, prefix: string, role: string): string {
  return i18nKey.startsWith(prefix) ? role : i18nKey;
}

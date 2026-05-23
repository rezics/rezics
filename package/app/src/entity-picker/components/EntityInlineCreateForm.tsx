import { useCreateEntity } from "@rezics/api/entity";
import type {
  CreateEntityInput,
  CreditAttributionRole,
  EntityKind,
  SubjectAttributionRole,
} from "@rezics/contract";
import {
  CreationMode,
  creditAttributionRoles,
  entityKinds,
  subjectAttributionRoles,
} from "@rezics/contract";
import { creditRoleLabel, subjectRoleLabel } from "@rezics/i18n";
import * as m from "@rezics/i18n/messages";
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
    onError: (err) => setError(err.message || m.entity_create_failed()),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError(m.entity_title_required());
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
        <Label htmlFor="entity-inline-title">{m.entity_title_label()}</Label>
        <Input
          id="entity-inline-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={m.entity_title_placeholder()}
          autoFocus
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entity-inline-language">{m.common_language()}</Label>
          <Input
            id="entity-inline-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder={m.language_code_placeholder()}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entity-inline-kind">{m.entity_kind_label()}</Label>
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
        <Label htmlFor="entity-inline-avatar">{m.entity_avatar_url()}</Label>
        <Input
          id="entity-inline-avatar"
          value={avatar}
          onChange={(e) => setAvatar(e.target.value)}
          placeholder={m.entity_avatar_placeholder()}
        />
      </div>
      <EligibilityRoleEditor
        label={m.entity_credit_eligibility()}
        roles={eligibleCreditRoles}
        availableRoles={availableCreditRoles}
        getLabel={creditRoleLabel}
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
        label={m.entity_subject_eligibility()}
        roles={eligibleSubjectRoles}
        availableRoles={availableSubjectRoles}
        getLabel={subjectRoleLabel}
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
            {m.common_cancel()}
          </Button>
        ) : null}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? m.common_creating() : m.common_create()}
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
  onAdd: (role: Role) => void;
  onRemove: (role: Role) => void;
}

function EligibilityRoleEditor<Role extends string>({
  label,
  roles,
  availableRoles,
  getLabel,
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
            {getLabel(role)}
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
          <option value="">{m.entity_add_role()}</option>
          {availableRoles.map((role) => (
            <option key={role} value={role}>
              {getLabel(role)}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

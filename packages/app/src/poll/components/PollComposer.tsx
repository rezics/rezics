import { useCreatePollMutation } from "@rezics/api/poll/poll.mutations";
import type {
  CreatePollInput,
  PollDTO,
  PollResultVisibility,
  PollVoteMode,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  Checkbox,
  Input,
  Label,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
} from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Link2, Plus, Trash2 } from "lucide-react";
import type React from "react";
import { useId, useMemo, useRef, useState } from "react";
import { UnitPicker } from "@/unit";

type DraftOption =
  | { key: number; kind: "text"; label: string }
  | { key: number; kind: "unit"; unitId: string };

export interface PollComposerProps {
  /**
   * Called with the freshly minted poll. When omitted, the composer navigates
   * to the poll's standalone page. The in-thread attach flow supplies this to
   * sequence post creation after the poll exists.
   */
  onCreated?: (poll: PollDTO) => void;
  submitLabel?: string;
}

/**
 * Authoring surface that builds a {@link CreatePollInput} (≥2 options, each ad
 * hoc text or a unit reference via the shared `UnitPicker`, plus vote mode,
 * result visibility, anonymity, and an optional close time) and mints the poll
 * through `useCreatePoll`.
 */
export const PollComposer: React.FC<PollComposerProps> = ({
  onCreated,
  submitLabel,
}) => {
  const { t } = useTranslation(["common", "community"]);
  const navigate = useNavigate();
  const createPoll = useCreatePollMutation();
  const anonymousId = useId();
  const closesAtId = useId();
  const titleId = useId();
  const descriptionId = useId();
  const keyRef = useRef(2);
  // Compute min datetime once on mount to avoid re-renders shifting the floor
  // 挂载时计算一次最小日期时间，避免重渲染导致下限漂移
  const closesAtMin = useMemo(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }, []);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState<DraftOption[]>([
    { key: 0, kind: "text", label: "" },
    { key: 1, kind: "text", label: "" },
  ]);
  const [voteMode, setVoteMode] = useState<PollVoteMode>("SINGLE");
  const [resultVisibility, setResultVisibility] =
    useState<PollResultVisibility>("LIVE");
  const [anonymous, setAnonymous] = useState(false);
  const [closesAt, setClosesAt] = useState("");
  const [pickingUnit, setPickingUnit] = useState(false);

  const nextKey = () => {
    keyRef.current += 1;
    return keyRef.current;
  };

  const addTextOption = () =>
    setOptions((prev) => [
      ...prev,
      { key: nextKey(), kind: "text", label: "" },
    ]);

  const addUnitOption = (unitId: string) => {
    setOptions((prev) => [...prev, { key: nextKey(), kind: "unit", unitId }]);
    setPickingUnit(false);
  };

  const removeOption = (key: number) =>
    setOptions((prev) => prev.filter((option) => option.key !== key));

  const moveOption = (index: number, direction: -1 | 1) =>
    setOptions((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });

  const setLabel = (key: number, label: string) =>
    setOptions((prev) =>
      prev.map((option) =>
        option.key === key && option.kind === "text"
          ? { ...option, label }
          : option,
      ),
    );

  const validOptions = options.filter((option) =>
    option.kind === "unit" ? true : option.label.trim().length > 0,
  );
  const canSubmit =
    title.trim().length > 0 &&
    validOptions.length >= 2 &&
    !createPoll.isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const input: CreatePollInput = {
      title: title.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
      voteMode,
      resultVisibility,
      anonymous,
      closesAt: closesAt ? new Date(closesAt).toISOString() : null,
      options: validOptions.map((option) =>
        option.kind === "unit"
          ? { unitId: option.unitId }
          : { label: option.label.trim() },
      ),
    };
    createPoll.mutate(input, {
      onSuccess: (poll) => {
        if (onCreated) {
          onCreated(poll);
          return;
        }
        navigate({ to: "/poll/$unitId", params: { unitId: poll.unitId } });
      },
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={titleId}>
            {t("community:poll_composer_title_field")}
          </Label>
          <Input
            id={titleId}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("community:poll_composer_title_placeholder")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={descriptionId}>
            {t("community:poll_composer_description")}
          </Label>
          <Textarea
            id={descriptionId}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t("community:poll_composer_description_placeholder")}
            rows={3}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {options.map((option, index) => (
          <div key={option.key} className="flex items-center gap-2">
            {option.kind === "text" ? (
              <Input
                value={option.label}
                placeholder={t("community:poll_composer_option_placeholder")}
                onChange={(event) => setLabel(option.key, event.target.value)}
              />
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border-whisper bg-surface-subtle px-3 py-2">
                <Link2 className="h-4 w-4 shrink-0 text-text-secondary" />
                <span className="truncate text-sm leading-ui text-text-secondary">
                  {t("community:poll_composer_unit_option_label", {
                    unitId: option.unitId,
                  })}
                </span>
              </div>
            )}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={t("community:poll_composer_move_up")}
              disabled={index === 0}
              onClick={() => moveOption(index, -1)}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={t("community:poll_composer_move_down")}
              disabled={index === options.length - 1}
              onClick={() => moveOption(index, 1)}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={t("community:poll_composer_remove_option")}
              disabled={options.length <= 2}
              onClick={() => removeOption(option.key)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addTextOption}
          >
            <Plus className="mr-1 h-4 w-4" />
            {t("community:poll_composer_add_option")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setPickingUnit((value) => !value)}
          >
            <Link2 className="mr-1 h-4 w-4" />
            {t("community:poll_composer_add_unit_option")}
          </Button>
        </div>

        {pickingUnit && (
          <UnitPicker
            label={t("community:poll_composer_pick_unit")}
            renderItemAction={(candidate) => (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addUnitOption(candidate.identifier)}
              >
                {t("common:add")}
              </Button>
            )}
          />
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>{t("community:poll_composer_vote_mode")}</Label>
          <ToggleGroup
            type="single"
            size="sm"
            value={voteMode}
            onValueChange={(value) => {
              if (value) setVoteMode(value as PollVoteMode);
            }}
          >
            <ToggleGroupItem value="SINGLE">
              {t("community:poll_vote_mode_single")}
            </ToggleGroupItem>
            <ToggleGroupItem value="MULTI">
              {t("community:poll_vote_mode_multi")}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{t("community:poll_composer_result_visibility")}</Label>
          <ToggleGroup
            type="single"
            size="sm"
            value={resultVisibility}
            onValueChange={(value) => {
              if (value) setResultVisibility(value as PollResultVisibility);
            }}
          >
            <ToggleGroupItem value="LIVE">
              {t("community:poll_composer_result_visibility_live")}
            </ToggleGroupItem>
            <ToggleGroupItem value="AFTER_CLOSE">
              {t("community:poll_composer_result_visibility_after_close")}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id={anonymousId}
            checked={anonymous}
            onCheckedChange={(value) => setAnonymous(value === true)}
          />
          <Label htmlFor={anonymousId}>
            {t("community:poll_composer_anonymous")}
          </Label>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={closesAtId}>
            {t("community:poll_composer_closes_at")}
          </Label>
          <Input
            id={closesAtId}
            type="datetime-local"
            value={closesAt}
            min={closesAtMin}
            onChange={(event) => setClosesAt(event.target.value)}
          />
        </div>
      </div>

      {validOptions.length < 2 && (
        <p className="text-sm leading-ui text-text-secondary">
          {t("community:poll_composer_min_options")}
        </p>
      )}
      {createPoll.isError && (
        <p className="text-sm leading-ui text-error-text">
          {t("community:poll_composer_error")}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
          {createPoll.isPending
            ? t("community:poll_composer_submitting")
            : (submitLabel ?? t("community:poll_composer_submit"))}
        </Button>
      </div>
    </div>
  );
};

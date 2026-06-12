import { getI18nRuntime } from "@rezics/i18n/runtime";

const i18nMessages = {
  feedback_type_bug: () =>
    getI18nRuntime().i18n.t("community:feedback_type_bug"),
  feedback_type_feature: () =>
    getI18nRuntime().i18n.t("community:feedback_type_feature"),
  feedback_type_report: () =>
    getI18nRuntime().i18n.t("community:feedback_type_report"),
  feedback_type_other: () =>
    getI18nRuntime().i18n.t("community:feedback_type_other"),
} as const;

import { useCreateFeedbackMutation } from "@rezics/api/feedback/feedback.mutations";
import type { CreateFeedbackInput } from "@rezics/api/feedback/feedback.types";
import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import { useRouterState } from "@tanstack/react-router";
import type React from "react";
import { useEffect, useState } from "react";

type FeedbackFormProps = {
  defaultValues?: Partial<CreateFeedbackInput>;
  onSubmitted?: () => void;
};

const typeOptions: {
  value: NonNullable<CreateFeedbackInput["type"]>;
  label: () => string;
}[] = [
  { value: "BUG", label: i18nMessages.feedback_type_bug },
  { value: "FEATURE", label: i18nMessages.feedback_type_feature },
  { value: "REPORT", label: i18nMessages.feedback_type_report },
  { value: "OTHER", label: i18nMessages.feedback_type_other },
];

export const FeedbackForm: React.FC<FeedbackFormProps> = ({
  defaultValues,
  onSubmitted,
}) => {
  const { t } = useTranslation(["common", "community"]);
  const locationKey = useRouterState({
    select: (s) => `${s.location.pathname}${s.location.search ?? ""}`,
  });
  const [form, setForm] = useState<CreateFeedbackInput>({
    url: "",
    content: defaultValues?.content ?? "",
    type: defaultValues?.type ?? "BUG",
  });

  useEffect(() => {
    setForm((prev) => ({ ...prev, url: locationKey }));
  }, [locationKey]);

  const [errors, setErrors] = useState({
    content: false,
  });

  const createMutation = useCreateFeedbackMutation();

  const handleChange = (field: keyof CreateFeedbackInput, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: false }));
  };

  const validate = () => {
    const newErrors = {
      content: !form.content.trim(),
    };
    setErrors(newErrors);
    return !newErrors.content;
  };

  const resetForm = () => {
    setForm({
      content: "",
      type: "BUG",
    });
    setErrors({ content: false });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    createMutation.mutate(form, {
      onSuccess: () => {
        resetForm();
        onSubmitted?.();
      },
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="feedback-type">
            {t("community:feedback_type_label")}
          </Label>
          <Select
            value={form.type ?? "BUG"}
            onValueChange={(v) => handleChange("type", v)}
          >
            <SelectTrigger id="feedback-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="feedback-content">
            {t("community:feedback_content_label")}
          </Label>
          <textarea
            id="feedback-content"
            placeholder={t("community:feedback_content_placeholder")}
            rows={4}
            value={form.content}
            onChange={(e) => handleChange("content", e.target.value)}
            aria-invalid={errors.content}
            className={
              "w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-fill " +
              (errors.content ? "border-border-error" : "border-border-whisper")
            }
          />
          {errors.content && (
            <p className="text-sm text-error-text">
              {t("community:feedback_content_required")}
            </p>
          )}
        </div>

        {createMutation.status === "error" && (
          <p className="text-error-text">
            {t("community:feedback_submit_failed")}
          </p>
        )}

        <div className="flex flex-row gap-4 justify-end">
          <Button variant="outline" type="button" onClick={resetForm}>
            {t("common:reset")}
          </Button>
          <Button type="submit" disabled={createMutation.status === "pending"}>
            {createMutation.status === "pending"
              ? t("common:submitting")
              : t("community:feedback_submit")}
          </Button>
        </div>
      </div>
    </form>
  );
};

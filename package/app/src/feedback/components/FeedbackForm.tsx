import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import { useCreateFeedbackMutation } from "@rezics/api/feedback/feedback.mutations";
import type { CreateFeedbackInput } from "@rezics/api/feedback/feedback.types";
import { useRouterState } from "@tanstack/react-router";
import type React from "react";
import { useEffect, useState } from "react";

type FeedbackFormProps = {
  defaultValues?: Partial<CreateFeedbackInput>;
  onSubmitted?: () => void;
};

const typeOptions: { value: NonNullable<CreateFeedbackInput["type"]>; label: string }[] = [
  { value: "BUG", label: "问题/缺陷" },
  { value: "FEATURE", label: "功能建议" },
  { value: "REPORT", label: "内容相关" },
  { value: "OTHER", label: "其他" },
];

const FeedbackForm: React.FC<FeedbackFormProps> = ({
  defaultValues,
  onSubmitted,
}) => {
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
          <Label htmlFor="feedback-type">反馈类型</Label>
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
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="feedback-content">详细内容</Label>
          <textarea
            id="feedback-content"
            placeholder="请提供详细描述、复现步骤或预期效果"
            rows={4}
            value={form.content}
            onChange={(e) => handleChange("content", e.target.value)}
            aria-invalid={errors.content}
            className={
              "w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-fill " +
              (errors.content
                ? "border-border-error"
                : "border-border-whisper")
            }
          />
          {errors.content && (
            <p className="text-sm text-error-text">请填写详细内容</p>
          )}
        </div>

        {createMutation.status === "error" && (
          <p className="text-error-text">提交失败，请稍后重试。</p>
        )}

        <div className="flex flex-row gap-4 justify-end">
          <Button variant="outline" type="button" onClick={resetForm}>
            重置
          </Button>
          <Button
            type="submit"
            disabled={createMutation.status === "pending"}
          >
            {createMutation.status === "pending" ? "提交中..." : "提交反馈"}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default FeedbackForm;

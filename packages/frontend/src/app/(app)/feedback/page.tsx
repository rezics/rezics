"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { useT } from "@/lib/i18n/locale";
import { useState } from "react";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | Feedback                    |
 * | Help us improve...          |
 * |-----------------------------|
 * | Subject  [input           ] |
 * | Details  [textarea        ] |
 * |           [              ] |
 * |           [Submit         ] |
 * +-----------------------------+
 * w-full, inputs full width.
 *
 * Tablet-Ultra-wide: max-w-xl mx-auto。
 *
 * 用户反馈提交页面：标题 + 详情 + 提交按钮。
 */
export default function FeedbackPage({
  initialSubject = "",
  initialDetails = "",
  disabled = false,
}: {
  readonly initialSubject?: string;
  readonly initialDetails?: string;
  readonly disabled?: boolean;
}) {
  const [t] = useT();
  const [subject, setSubject] = useState(initialSubject);
  const [details, setDetails] = useState(initialDetails);

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-bold">{t.feedback.title}</h1>
        <p className="text-muted-foreground text-sm">
          {t.feedback.subtitle}
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          toast.success({ title: t.feedback.submitted });
          setSubject("");
          setDetails("");
        }}
      >
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="feedback-subject">
            {t.feedback.subject}
          </label>
          <Input
            id="feedback-subject"
            disabled={disabled}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t.feedback.subjectPlaceholder}
            value={subject}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="feedback-details">
            {t.feedback.details}
          </label>
          <Textarea
            className="min-h-32"
            id="feedback-details"
            disabled={disabled}
            onChange={(e) => setDetails(e.target.value)}
            placeholder={t.feedback.detailsPlaceholder}
            value={details}
          />
        </div>

        <Button disabled={disabled} type="submit">{t.feedback.submit}</Button>
      </form>
    </div>
  );
}

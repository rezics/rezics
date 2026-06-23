"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
export default function FeedbackPage() {
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-bold">Feedback</h1>
        <p className="text-muted-foreground text-sm">
          Help us improve rezics. Share your thoughts, report bugs, or suggest features.
        </p>
      </div>

      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="feedback-subject">
            Subject
          </label>
          <Input
            id="feedback-subject"
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief summary"
            value={subject}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="feedback-details">
            Details
          </label>
          <Textarea
            className="min-h-32"
            id="feedback-details"
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Describe in detail..."
            value={details}
          />
        </div>

        <Button type="submit">Submit Feedback</Button>
      </form>
    </div>
  );
}

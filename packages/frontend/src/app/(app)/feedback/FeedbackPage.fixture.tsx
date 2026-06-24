"use client";

import FeedbackPage from "./page";

export default {
  Default: <FeedbackPage />,
  EmptyMobile: (
    <div className="w-[320px] p-4">
      <FeedbackPage />
    </div>
  ),
  LongDraft: (
    <div className="w-[320px] p-4">
      <FeedbackPage
        initialDetails="The book detail page shows duplicate attribution metadata when a very long translated title is open from a realm-specific discussion. Please check the mobile layout, because the submit control remains visible but the textarea content is long enough to stress wrapping and vertical rhythm."
        initialSubject="Long mobile layout feedback about translated titles"
      />
    </div>
  ),
  DisabledSubmitted: (
    <div className="p-4">
      <FeedbackPage
        disabled
        initialDetails="A submitted feedback item is locked while moderation metadata syncs."
        initialSubject="Submitted feedback locked"
      />
    </div>
  ),
};

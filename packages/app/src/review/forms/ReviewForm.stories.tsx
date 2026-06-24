import type { PostDTO } from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { userEvent, within } from "storybook/test";

import { type ReviewEditState, ReviewForm } from "./ReviewForm";

const Wrapper = (args: { initial: ReviewEditState; post?: PostDTO }) => {
  const [data, setData] = useState<ReviewEditState>(args.initial);
  return (
    <ReviewForm
      data={data}
      setData={setData}
      submitLabel="Publish"
      defaultLanguage="en"
      post={args.post}
    />
  );
};

const empty: ReviewEditState = {
  unitId: "review-draft",
  contentSource: "",
  _editTitle: "",
  _editRating: 0,
  extra: {},
};

const filled: ReviewEditState = {
  ...empty,
  _editTitle: "Quiet endings, second readings",
  _editRating: 8,
  contentSource:
    "On a second pass the architecture finally reveals itself: chapter 17 is the actual climax, and the final chapter is a quiet coda. The translator's note in the back matter is itself a small essay; don't skip it. Worth re-reading every couple of years.",
};

const meta = {
  title: "Domain/Review/ReviewForm",
  component: Wrapper,
  args: { initial: filled },
} satisfies Meta<typeof Wrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const UpdateMode: Story = {
  args: {
    initial: { ...filled, language: "en" },
    post: {
      unitId: "review-existing",
      title: filled._editTitle,
      content: { schema: "rezics.content", version: 1 },
      resolvedLanguage: "en",
      authorUserId: "user-1",
      author: null,
      extra: { rating: 8 },
    } as PostDTO,
  },
};

export const Empty: Story = {
  args: { initial: empty },
};

export const WithError: Story = {
  args: {
    initial: { ...empty, contentSource: "Too short.", _editRating: 6 },
  },
};

export const HappyPath: Story = {
  args: { initial: empty },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const titleField = canvas.getByPlaceholderText(/title/i);
    await userEvent.type(titleField, "A worthy second read");
  },
};

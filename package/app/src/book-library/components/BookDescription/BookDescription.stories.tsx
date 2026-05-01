import { faker } from "@faker-js/faker";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";

import { BookDescription } from "./index";

const meta = {
  title: "App/BookLibrary/BookDescription",
  component: BookDescription,
} satisfies Meta<typeof BookDescription>;

export default meta;
type Story = StoryObj<typeof meta>;

function PreviewWithLengths() {
  const [description, setDescription] = useState("");
  const [sentence, setSentence] = useState("");
  const [paragraph, setParagraph] = useState("");

  useEffect(() => {
    setDescription(faker.lorem.paragraphs({ min: 2, max: 5 }));
    setSentence(faker.lorem.sentence());
    setParagraph(faker.lorem.paragraph());
  }, []);

  return (
    <div className="p-4 max-w-2xl">
      <h3 className="mb-4 text-lg font-semibold">Book Description Component</h3>
      <div className="border border-gray-200 rounded-lg p-4">
        <BookDescription description={description} />
      </div>
      <div className="mt-4 space-y-4">
        <h4 className="font-medium mb-2">Different lengths</h4>
        <div className="space-y-2">
          <div className="border rounded p-2">
            <BookDescription description={sentence} />
          </div>
          <div className="border rounded p-2">
            <BookDescription description={paragraph} />
          </div>
        </div>
      </div>
    </div>
  );
}

export const Default: Story = {
  render: () => <PreviewWithLengths />,
};

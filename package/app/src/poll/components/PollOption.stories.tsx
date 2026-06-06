import type { Meta, StoryObj } from "@storybook/react-vite";
import type { PollOptionView } from "../models/pollView";
import { PollOption } from "./PollOption";

function optionView(overrides: Partial<PollOptionView> = {}): PollOptionView {
  return {
    optionId: "opt-a",
    form: "text",
    label: "Dune",
    unitId: null,
    selected: false,
    voteCount: 8,
    percent: 64,
    ...overrides,
  };
}

const meta = {
  title: "App/Poll/PollOption",
  component: PollOption,
  args: {
    voteMode: "SINGLE",
    votingEnabled: true,
    countsVisible: true,
    pending: false,
    onSelect: () => {},
  },
  decorators: [
    (Story) => (
      <div className="max-w-md p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PollOption>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TextSelected: Story = {
  args: { option: optionView({ selected: true }) },
};

export const TextUnselected: Story = {
  args: { option: optionView({ selected: false }) },
};

export const MultiSelected: Story = {
  args: { voteMode: "MULTI", option: optionView({ selected: true }) },
};

export const CountsWithheld: Story = {
  args: {
    countsVisible: false,
    option: optionView({ voteCount: undefined, percent: 0 }),
  },
};

export const Closed: Story = {
  args: {
    votingEnabled: false,
    option: optionView({ selected: true }),
  },
};

export const Tombstone: Story = {
  args: {
    option: optionView({
      form: "tombstone",
      label: null,
      voteCount: 1,
      percent: 8,
    }),
  },
};

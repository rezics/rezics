import { unitDetailQuery } from "@rezics/api/unit/unit";
import type { PollResultsDTO, UnitDTO } from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PollView } from "./PollView";

const baseOptions: PollResultsDTO["options"] = [
  {
    pollUnitId: "poll-1",
    optionId: "opt-a",
    position: "a",
    label: "Dune",
    voteCount: 8,
  },
  {
    pollUnitId: "poll-1",
    optionId: "opt-b",
    position: "b",
    label: "Foundation",
    voteCount: 5,
  },
  {
    pollUnitId: "poll-1",
    optionId: "opt-c",
    position: "c",
    label: "Neuromancer",
    voteCount: 2,
  },
];

function results(overrides: Partial<PollResultsDTO> = {}): PollResultsDTO {
  return {
    pollUnitId: "poll-1",
    voteMode: "SINGLE",
    resultVisibility: "LIVE",
    anonymous: false,
    closed: false,
    resultsVisible: true,
    options: baseOptions,
    totalVotes: 15,
    myVote: ["opt-a"],
    ...overrides,
  };
}

/**
 * Seeds referenced units into the query cache so unit-form options render their
 * unit card without a live backend, then mounts the view.
 */
function SeededPollView({
  data,
  units = [],
}: {
  data: PollResultsDTO;
  units?: UnitDTO[];
}) {
  const qc = useQueryClient();
  const [ready, setReady] = useState(units.length === 0);
  useEffect(() => {
    for (const unit of units) {
      qc.setQueryData(unitDetailQuery(unit.id).queryKey, unit);
    }
    setReady(true);
  }, [qc, units]);
  if (!ready) return null;
  return (
    <div className="mx-auto max-w-md p-6">
      <PollView results={data} />
    </div>
  );
}

const meta = {
  title: "App/Poll/PollView",
  component: PollView,
} satisfies Meta<typeof PollView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleLive: Story = {
  render: () => <SeededPollView data={results()} />,
};

export const MultiLive: Story = {
  render: () => (
    <SeededPollView
      data={results({ voteMode: "MULTI", myVote: ["opt-a", "opt-c"] })}
    />
  ),
};

export const ResultsWithheld: Story = {
  render: () => (
    <SeededPollView
      data={results({
        resultVisibility: "AFTER_CLOSE",
        resultsVisible: false,
        totalVotes: undefined,
        options: baseOptions.map((o) => ({ ...o, voteCount: undefined })),
        myVote: ["opt-b"],
      })}
    />
  ),
};

export const Closed: Story = {
  render: () => <SeededPollView data={results({ closed: true })} />,
};

export const Anonymous: Story = {
  render: () => (
    <SeededPollView data={results({ anonymous: true, myVote: ["opt-b"] })} />
  ),
};

export const UnitAndTombstoneOptions: Story = {
  render: () => (
    <SeededPollView
      units={[
        {
          id: "unit-100",
          type: "BOOK",
          translations: [{ title: "The Left Hand of Darkness" }],
        } as unknown as UnitDTO,
      ]}
      data={results({
        totalVotes: 12,
        options: [
          {
            pollUnitId: "poll-1",
            optionId: "opt-a",
            position: "a",
            label: null,
            unitId: "unit-100",
            voteCount: 7,
          },
          {
            pollUnitId: "poll-1",
            optionId: "opt-b",
            position: "b",
            label: "A plain text option",
            voteCount: 4,
          },
          {
            pollUnitId: "poll-1",
            optionId: "opt-c",
            position: "c",
            label: null,
            unitId: null,
            voteCount: 1,
          },
        ],
        myVote: ["opt-a"],
      })}
    />
  ),
};

import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Textarea,
} from "@rezics/ui/shadcn";
import type { Meta, StoryObj } from "@storybook/react-vite";
import React from "react";
import { SearchablePaginatedTableCard } from "@/components/list/SearchablePaginatedTableCard";
import type { PaginatedColumn } from "@/components/table/PaginatedTable";

type DemoRow = {
  id: string;
  title: string;
  status: string;
};

const columns: PaginatedColumn<DemoRow>[] = [
  {
    id: "id",
    header: "Unit ID",
    minWidth: 180,
    cell: (row) => <span className="font-mono text-sm">{row.id}</span>,
  },
  {
    id: "title",
    header: "Title",
    minWidth: 180,
    cell: (row) => <span className="text-sm font-medium">{row.title}</span>,
  },
  {
    id: "status",
    header: "Status",
    minWidth: 120,
    cell: (row) => row.status,
  },
];

const rows: DemoRow[] = [
  { id: "unit-book-001", title: "Example release", status: "active" },
  { id: "unit-work-001", title: "Hidden work domain", status: "hidden" },
];

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="max-w-[900px] bg-surface-canvas p-6">{children}</div>;
}

function DemoTable({
  rows,
  isLoading = false,
  isError = false,
  errorLabel,
}: {
  rows: DemoRow[];
  isLoading?: boolean;
  isError?: boolean;
  errorLabel?: string;
}) {
  const [q, setQ] = React.useState("");
  return (
    <SearchablePaginatedTableCard<DemoRow>
      title="Content operation table"
      description="Compact admin table state used by Unit, entity, realm, shelf, and source-site operations."
      searchInputId="content-operation-story-search"
      searchPlaceholder="search units"
      q={q}
      onQChange={setQ}
      onSearch={() => undefined}
      isLoading={isLoading}
      isError={isError}
      errorLabel={errorLabel}
      columns={columns}
      rows={rows}
      getRowId={(row) => row.id}
      count={rows.length}
      page={0}
      rowsPerPage={20}
      onPageChange={() => undefined}
      onRowsPerPageChange={() => undefined}
    />
  );
}

const meta = {
  title: "Admin/Content Operation States",
  parameters: {
    docs: {
      description: {
        component:
          "Shared operation states for empty, loading, forbidden, validation, and destructive admin content workflows.",
      },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  render: () => (
    <Frame>
      <DemoTable rows={[]} />
    </Frame>
  ),
};

export const Loading: Story = {
  render: () => (
    <Frame>
      <DemoTable rows={[]} isLoading />
    </Frame>
  ),
};

export const Forbidden: Story = {
  render: () => (
    <Frame>
      <DemoTable
        rows={[]}
        isError
        errorLabel="Forbidden: owner or admin authority is required."
      />
    </Frame>
  ),
};

export const Validation: Story = {
  render: () => (
    <Frame>
      <Card surface="contained">
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription className="text-error-text">
              Field lock reason must explain the operator action.
            </AlertDescription>
          </Alert>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="story-lock-path">Field path</Label>
              <Input
                id="story-lock-path"
                value="translations.en.title"
                readOnly
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="story-lock-reason">Audit reason</Label>
              <Textarea
                id="story-lock-reason"
                value=""
                readOnly
                placeholder="why this field requires operator lock"
              />
            </div>
          </div>
          <Button>Apply field lock</Button>
        </CardContent>
      </Card>
    </Frame>
  ),
};

export const DestructiveConfirmation: Story = {
  render: () => (
    <Frame>
      <Card surface="contained">
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-base font-semibold">Remove collaborator</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Impact: user-123 loses editor authority on unit-book-001. Existing
              history entries remain unchanged.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline">Cancel</Button>
            <Button variant="destructive">Confirm removal</Button>
          </div>
        </CardContent>
      </Card>
    </Frame>
  ),
};

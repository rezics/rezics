import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

const meta = {
  title: "Primitives/Table",
  component: Table,
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

const rows = [
  { title: "The Stranger", author: "Camus", pages: 159, status: "Reading" },
  {
    title: "Norwegian Wood",
    author: "Murakami",
    pages: 296,
    status: "Up next",
  },
  { title: "Pale Fire", author: "Nabokov", pages: 246, status: "Finished" },
];

function TableSample() {
  return (
    <Table>
      <TableCaption>Recent activity</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Author</TableHead>
          <TableHead>Pages</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.title}>
            <TableCell className="font-medium">{r.title}</TableCell>
            <TableCell>{r.author}</TableCell>
            <TableCell>{r.pages}</TableCell>
            <TableCell>{r.status}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export const Default: Story = {
  render: () => (
    <div className="w-full max-w-2xl">
      <TableSample />
    </div>
  ),
};

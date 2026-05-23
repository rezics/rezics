import * as m from "@rezics/i18n/messages";
import {
  Badge,
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@rezics/ui/shadcn";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "Admin/Density",
  parameters: {
    docs: {
      description: {
        component:
          "Admin density baseline — outlined inputs, dense tables, terse copy. Mirrors the admin app's vocabulary on top of the rezics token palette.",
      },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

// MOCK: placeholder admin row data until wired to a real query
const rows = [
  { id: 1, email: "ada@rezics.local", role: "admin", status: "active" },
  { id: 2, email: "bell@rezics.local", role: "editor", status: "active" },
  { id: 3, email: "carl@rezics.local", role: "reader", status: "invited" },
  { id: 4, email: "dora@rezics.local", role: "reader", status: "suspended" },
];

function statusVariant(status: string) {
  switch (status) {
    case "active":
      return "bg-success-fill text-white";
    case "suspended":
      return "bg-error-fill text-white";
    default:
      return "";
  }
}

export const UsersTable: Story = {
  render: () => (
    <div className="flex flex-col gap-6 max-w-[720px]">
      <div className="flex flex-row gap-4 items-center">
        <h2 className="flex-1 text-2xl font-bold">{m.admin_nav_users()}</h2>
        <Input
          placeholder={m.admin_story_search_email_placeholder()}
          className="min-w-[220px] h-8"
        />
        <Button size="sm">{m.admin_story_invite()}</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{m.common_email()}</TableHead>
            <TableHead>{m.admin_auth_user_role()}</TableHead>
            <TableHead>{m.admin_auth_email_status()}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} className="h-10">
              <TableCell>{r.email}</TableCell>
              <TableCell>{r.role}</TableCell>
              <TableCell>
                <Badge
                  variant={r.status === "invited" ? "outline" : "default"}
                  className={statusVariant(r.status)}
                >
                  {r.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ),
};

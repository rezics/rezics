import {
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "Admin/Density",
  parameters: {
    docs: {
      description: {
        component:
          "Admin density baseline — outlined inputs, dense tables, terse copy. Mirrors the admin app's MUI vocabulary on top of the rezics token palette.",
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

export const UsersTable: Story = {
  render: () => (
    <Stack spacing={3} sx={{ maxWidth: 720 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="h2" sx={{ flex: 1 }}>
          Users
        </Typography>
        <TextField
          variant="outlined"
          size="small"
          placeholder="Search email"
          sx={{ minWidth: 220 }}
        />
        <Button variant="contained" size="small">
          Invite
        </Button>
      </Stack>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} sx={{ height: 40 }}>
                <TableCell>{r.email}</TableCell>
                <TableCell>{r.role}</TableCell>
                <TableCell>
                  <Chip
                    label={r.status}
                    size="small"
                    color={
                      r.status === "active"
                        ? "success"
                        : r.status === "suspended"
                          ? "error"
                          : "default"
                    }
                    variant="outlined"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  ),
};

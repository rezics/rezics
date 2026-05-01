import { Box, Card, CardMedia, Stack, Typography } from "@mui/material";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "App/Sections",
  parameters: {
    docs: {
      description: {
        component:
          "Generous app-side density. Borderless sections, content-led cards, parchment surface.",
      },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

// MOCK: placeholder book grid until /api/books is wired
const books = [
  { id: 1, title: "The Sense of Style", author: "Steven Pinker" },
  { id: 2, title: "Sapiens", author: "Yuval Noah Harari" },
  { id: 3, title: "Norwegian Wood", author: "Haruki Murakami" },
  { id: 4, title: "The Three-Body Problem", author: "Liu Cixin" },
];

function BookCard({ title, author }: { title: string; author: string }) {
  return (
    <Card
      sx={{
        p: 0,
        bgcolor: "transparent",
        border: "none",
        boxShadow: "none",
        width: 160,
      }}
    >
      <CardMedia
        component="div"
        sx={{
          aspectRatio: "2/3",
          borderRadius: 1,
          background:
            "linear-gradient(135deg, var(--rezics-color-surface-raised), var(--rezics-color-surface-sunken))",
        }}
      />
      <Box sx={{ pt: 1.5 }}>
        <Typography variant="body1" fontWeight={500} noWrap>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" noWrap>
          {author}
        </Typography>
      </Box>
    </Card>
  );
}

export const RecentBooks: Story = {
  render: () => (
    <Box sx={{ py: 8 }}>
      <Typography variant="h2" mb={4}>
        Recent Books
      </Typography>
      <Stack direction="row" spacing={4} sx={{ overflowX: "auto" }}>
        {books.map((b) => (
          <BookCard key={b.id} title={b.title} author={b.author} />
        ))}
      </Stack>
    </Box>
  ),
};

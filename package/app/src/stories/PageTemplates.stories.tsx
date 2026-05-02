import { Avatar, Box, Stack, Typography } from "@mui/material";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { BookCard as VerticalBookCard } from "@/book-library/components/item/VerticalBookCard";
import { ReviewCard } from "@/review/components/item/ReviewCard";
import { withRouter } from "@/stories/decorators/withRouter";
import { bookCardPropsList } from "@/stories/fixtures/book";
import { reviewLong, reviewShort } from "@/stories/fixtures/review";

const meta = {
  title: "Page/Templates",
  decorators: [withRouter],
  parameters: {
    docs: {
      description: {
        component:
          "Illustrative-not-canonical page templates. They wire fixture data through real domain components to demonstrate page-level rhythm; they do **not** reflect the production route components, which pull live data from many queries.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Homepage: Story = {
  parameters: {
    docs: { description: { story: "illustrative-not-canonical" } },
  },
  render: () => (
    <Box sx={{ maxWidth: 1100, mx: "auto", px: 3 }}>
      <Box sx={{ py: 8 }}>
        <Typography
          variant="overline"
          sx={{ color: "primary.main", letterSpacing: "0.35em" }}
        >
          Library
        </Typography>
        <Typography variant="h1" sx={{ mt: 1 }}>
          Read together
        </Typography>
      </Box>

      <Box
        sx={{
          py: 6,
          borderTop: "1px solid var(--rezics-color-border-whisper)",
        }}
      >
        <Typography variant="h2" mb={3}>
          Recent Books
        </Typography>
        <Stack direction="row" spacing={3} sx={{ overflowX: "auto", pb: 2 }}>
          {bookCardPropsList.slice(0, 6).map((book) => (
            <Box key={book.id} sx={{ width: 180, flexShrink: 0 }}>
              <VerticalBookCard
                title={book.title}
                author={book.author}
                description={book.description}
                coverUrl={book.coverUrl}
                href={book.href}
              />
            </Box>
          ))}
        </Stack>
      </Box>

      <Box
        sx={{
          py: 6,
          borderTop: "1px solid var(--rezics-color-border-whisper)",
        }}
      >
        <Typography variant="h2" mb={3}>
          Trending Reviews
        </Typography>
        <Stack spacing={3}>
          <ReviewCard review={reviewLong} />
          <ReviewCard review={reviewShort} />
        </Stack>
      </Box>
    </Box>
  ),
};

export const BookDetail: Story = {
  parameters: {
    docs: { description: { story: "illustrative-not-canonical" } },
  },
  render: () => {
    const book = bookCardPropsList[0];
    return (
      <Box sx={{ maxWidth: 1100, mx: "auto", px: 3, py: 6 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={4}>
          <Box sx={{ width: 220, flexShrink: 0 }}>
            <VerticalBookCard
              title={book.title}
              author={book.author}
              description={book.description}
              coverUrl={book.coverUrl}
              href={book.href}
            />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h1" sx={{ mb: 2 }}>
              {book.title}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              {book.description ?? "—"}
            </Typography>
            <Typography variant="body1">
              Across twelve essays, the narrator walks through public libraries
              from Tokyo to Buenos Aires, tracing how each city's reading rooms
              shape the books that find their way home with us.
            </Typography>
          </Box>
        </Stack>

        <Box
          sx={{
            py: 6,
            mt: 4,
            borderTop: "1px solid var(--rezics-color-border-whisper)",
          }}
        >
          <Typography variant="h2" mb={3}>
            Reviews
          </Typography>
          <Stack spacing={3}>
            <ReviewCard review={reviewLong} />
            <ReviewCard review={reviewShort} />
          </Stack>
        </Box>
      </Box>
    );
  },
};

export const Profile: Story = {
  parameters: {
    docs: { description: { story: "illustrative-not-canonical" } },
  },
  render: () => (
    <Box sx={{ maxWidth: 900, mx: "auto", px: 3, py: 6 }}>
      <Stack direction="row" spacing={3} alignItems="center">
        <Avatar
          src="https://i.pravatar.cc/120?u=mei"
          sx={{ width: 96, height: 96 }}
        />
        <Box>
          <Typography variant="h1">Mei Tanaka</Typography>
          <Typography variant="body2" color="text.secondary">
            @mei · Reading widely; writing slowly.
          </Typography>
        </Box>
      </Stack>

      <Box
        sx={{
          py: 6,
          mt: 4,
          borderTop: "1px solid var(--rezics-color-border-whisper)",
        }}
      >
        <Typography variant="h2" mb={3}>
          Recent reviews
        </Typography>
        <Stack spacing={3}>
          <ReviewCard review={reviewLong} />
          <ReviewCard review={reviewShort} />
        </Stack>
      </Box>
    </Box>
  ),
};

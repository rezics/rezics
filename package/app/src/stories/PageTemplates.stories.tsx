import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@rezics/ui/shadcn";
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
    <div className="mx-auto w-full max-w-[1100px] px-6">
      <div className="py-16">
        <p className="text-xs uppercase tracking-[0.35em] text-rezics-color-brand-fill">
          Library
        </p>
        <h1 className="text-5xl font-semibold mt-2">Read together</h1>
      </div>

      <div className="py-12 border-t border-rezics-color-border-whisper">
        <h2 className="text-3xl font-semibold mb-6">Recent Books</h2>
        <div className="flex flex-row gap-6 overflow-x-auto pb-4">
          {bookCardPropsList.slice(0, 6).map((book) => (
            <div key={book.id} className="w-[180px] flex-shrink-0">
              <VerticalBookCard
                title={book.title}
                author={book.author}
                coverUrl={book.coverUrl}
                href={book.href}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="py-12 border-t border-rezics-color-border-whisper">
        <h2 className="text-3xl font-semibold mb-6">Trending Reviews</h2>
        <div className="flex flex-col gap-6">
          <ReviewCard review={reviewLong} />
          <ReviewCard review={reviewShort} />
        </div>
      </div>
    </div>
  ),
};

export const BookDetail: Story = {
  parameters: {
    docs: { description: { story: "illustrative-not-canonical" } },
  },
  render: () => {
    const book = bookCardPropsList[0];
    return (
      <div className="mx-auto w-full max-w-[1100px] px-6 py-12">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-[220px] flex-shrink-0">
            <VerticalBookCard
              title={book.title}
              author={book.author}
              coverUrl={book.coverUrl}
              href={book.href}
            />
          </div>
          <div className="flex-1">
            <h1 className="text-5xl font-semibold mb-4">{book.title}</h1>
            <p className="text-base text-rezics-color-fg-muted mb-8">
              {book.description ?? "—"}
            </p>
            <p className="text-base">
              Across twelve essays, the narrator walks through public libraries
              from Tokyo to Buenos Aires, tracing how each city's reading rooms
              shape the books that find their way home with us.
            </p>
          </div>
        </div>

        <div className="py-12 mt-8 border-t border-rezics-color-border-whisper">
          <h2 className="text-3xl font-semibold mb-6">Reviews</h2>
          <div className="flex flex-col gap-6">
            <ReviewCard review={reviewLong} />
            <ReviewCard review={reviewShort} />
          </div>
        </div>
      </div>
    );
  },
};

export const Profile: Story = {
  parameters: {
    docs: { description: { story: "illustrative-not-canonical" } },
  },
  render: () => (
    <div className="mx-auto w-full max-w-[900px] px-6 py-12">
      <div className="flex flex-row gap-6 items-center">
        <Avatar className="w-24 h-24">
          <AvatarImage src="https://i.pravatar.cc/120?u=mei" />
          <AvatarFallback>M</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-5xl font-semibold">Mei Tanaka</h1>
          <p className="text-sm text-rezics-color-fg-muted">
            @mei · Reading widely; writing slowly.
          </p>
        </div>
      </div>

      <div className="py-12 mt-8 border-t border-rezics-color-border-whisper">
        <h2 className="text-3xl font-semibold mb-6">Recent reviews</h2>
        <div className="flex flex-col gap-6">
          <ReviewCard review={reviewLong} />
          <ReviewCard review={reviewShort} />
        </div>
      </div>
    </div>
  ),
};

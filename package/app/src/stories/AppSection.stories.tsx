import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "App/Sections",
  parameters: {
    docs: {
      description: {
        component:
          "Generous app-side density. Borderless sections, content-led cards, plain canvas.",
      },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

// MOCK: placeholder book grid until /api/books is wired
// MOCK：占位的书籍网格，直到 /api/books 接入
const books = [
  { id: 1, title: "The Sense of Style", author: "Steven Pinker" },
  { id: 2, title: "Sapiens", author: "Yuval Noah Harari" },
  { id: 3, title: "Norwegian Wood", author: "Haruki Murakami" },
  { id: 4, title: "The Three-Body Problem", author: "Liu Cixin" },
];

function BookCard({ title, author }: { title: string; author: string }) {
  return (
    <div className="w-40">
      <div
        className="rounded-md"
        style={{
          aspectRatio: "2 / 3",
          background:
            "linear-gradient(135deg, var(--colors-surface-elevated), var(--colors-surface-sunken))",
        }}
      />
      <div className="pt-3">
        <p className="text-base font-medium truncate">{title}</p>
        <p className="text-sm text-text-secondary truncate">{author}</p>
      </div>
    </div>
  );
}

export const RecentBooks: Story = {
  render: () => (
    <div className="py-16">
      <h2 className="text-2xl font-semibold mb-8">Recent Books</h2>
      <div className="flex flex-row gap-8 overflow-x-auto">
        {books.map((b) => (
          <BookCard key={b.id} title={b.title} author={b.author} />
        ))}
      </div>
    </div>
  ),
};

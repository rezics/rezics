import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  type CardElevation,
  CardFooter,
  CardHeader,
  CardMedia,
  CardTitle,
} from "./card";

const meta = {
  title: "Primitives/Card",
  component: Card,
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

const cardElevationLevels = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
] as const satisfies readonly CardElevation[];

export const Default: Story = {
  render: () => (
    <Card surface="contained" className="max-w-sm">
      <CardHeader>
        <CardTitle>Reading list</CardTitle>
        <CardDescription>23 unread, 4 in progress</CardDescription>
      </CardHeader>
      <CardContent>
        Pick up where you left off, or start something new.
      </CardContent>
      <CardFooter>
        <Button>Open library</Button>
      </CardFooter>
    </Card>
  ),
};

export const Plain: Story = {
  render: () => (
    <Card surface="plain" className="max-w-sm">
      <CardHeader>
        <CardTitle>Member list</CardTitle>
        <CardDescription>85 books / 330 voters</CardDescription>
      </CardHeader>
      <CardContent>
        Flat content items use the page surface. The media, title, and metadata
        carry the card shape without an outer container.
      </CardContent>
    </Card>
  ),
};

export const Contained: Story = {
  render: () => (
    <Card surface="contained" className="max-w-sm">
      <CardHeader>
        <CardTitle>Catalog note</CardTitle>
        <CardDescription>Default application card surface</CardDescription>
      </CardHeader>
      <CardContent>
        Use contained cards for panels and compact information groups that need
        tonal separation without border chrome.
      </CardContent>
    </Card>
  ),
};

export const Elevated: Story = {
  render: () => (
    <Card surface="elevated" className="max-w-sm">
      <CardMedia className="h-28 bg-surface-subtle" />
      <CardHeader>
        <CardTitle>Editors' picks</CardTitle>
        <CardDescription>Same-color media card</CardDescription>
      </CardHeader>
      <CardContent>
        Use elevated cards sparingly for media-rich recommendations, articles,
        and featured content collections.
      </CardContent>
    </Card>
  ),
};

export const SurfaceComparison: Story = {
  render: () => (
    <div className="grid max-w-4xl gap-4 bg-surface-canvas p-4 text-text-primary md:grid-cols-3">
      <Card surface="plain" interactive>
        <CardMedia className="h-24 bg-surface-subtle" />
        <CardHeader>
          <CardTitle>Plain</CardTitle>
          <CardDescription>Inset state layer on hover</CardDescription>
        </CardHeader>
      </Card>
      <Card surface="contained" interactive>
        <CardMedia className="h-24 bg-surface-subtle" />
        <CardHeader>
          <CardTitle>Contained</CardTitle>
          <CardDescription>Tonal panel with hover lift</CardDescription>
        </CardHeader>
      </Card>
      <Card surface="elevated" interactive>
        <CardMedia className="h-24 bg-surface-subtle" />
        <CardHeader>
          <CardTitle>Elevated</CardTitle>
          <CardDescription>Same-color card with shadow lift</CardDescription>
        </CardHeader>
      </Card>
    </div>
  ),
};

export const ElevatedScale: Story = {
  render: () => (
    <div className="grid max-w-6xl gap-4 bg-surface-canvas p-4 text-text-primary sm:grid-cols-2 lg:grid-cols-5">
      {cardElevationLevels.map((level) => (
        <Card
          key={level}
          elevation={level}
          interactive
          surface="elevated"
          className="min-w-0"
        >
          <CardMedia className="h-20 bg-surface-subtle" />
          <CardHeader>
            <CardTitle>Level {level}</CardTitle>
            <CardDescription>Same-color elevated card</CardDescription>
          </CardHeader>
        </Card>
      ))}
    </div>
  ),
};

export const WithAction: Story = {
  render: () => (
    <Card surface="contained" className="max-w-sm">
      <CardHeader>
        <CardTitle>Annotations</CardTitle>
        <CardDescription>Last synced 2 minutes ago</CardDescription>
        <CardAction>
          <Button size="sm" variant="ghost">
            Sync
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>432 highlights across 12 books.</CardContent>
    </Card>
  ),
};

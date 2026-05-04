import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";

const meta = {
  title: "Primitives/Card",
  component: Card,
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="max-w-sm">
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

export const WithAction: Story = {
  render: () => (
    <Card className="max-w-sm">
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

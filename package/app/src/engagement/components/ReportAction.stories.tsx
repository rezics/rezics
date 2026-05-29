import { ApiError } from "@rezics/api";
import { governanceApi } from "@rezics/api/governance/governance.api";
import type { Permission, RealmModerationQueueItemDTO } from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode, useEffect, useState } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";

import { withRouter } from "@/stories/decorators/withRouter";
import { useAuthSessionStore } from "@/user/states";
import { ReportAction } from "./ReportAction";

const REALM_UNIT_ID = "realm-fixture";
const TARGET = { kind: "post", id: "unit-post-1" } as const;
const now = "2026-05-29T00:00:00.000Z";

function authenticate(isAuthenticated: boolean) {
  if (!isAuthenticated) {
    useAuthSessionStore.getState().reset();
    return;
  }
  useAuthSessionStore.setState({
    status: "ready",
    auth: { session: null, user: null, role: "MEMBER", hasIdentity: true },
    rezics: {
      userId: "story-user",
      permission: { role: "MEMBER" } as Permission,
      governanceCapabilities: [],
      hasMemberSession: true,
      hasProfileSetupSession: false,
      mainUserExists: true,
    },
    registration: {
      stage: "complete",
      emailVerified: true,
      complete: true,
      needsVerification: false,
      needsMainSetup: false,
    },
    authAccountState: null,
    capabilityLevel: "member",
    error: null,
  });
}

type Outcome = "success" | "rate-limited";

function mockCreateQueueItem(outcome: Outcome) {
  if (outcome === "rate-limited") {
    governanceApi.createRealmQueueItem = async () => {
      throw new ApiError(429, "RATE_LIMITED", "Too many reports");
    };
    return;
  }
  governanceApi.createRealmQueueItem = async (realmUnitId) =>
    ({
      id: "queue-story-1",
      realmUnitId,
      state: "new",
      reporterUserId: "story-user",
      subjectUserId: null,
      target: { ...TARGET, realmUnitId },
      sourceFeedbackId: null,
      linkedCaseId: null,
      assignedToUserId: null,
      reason: "Story report",
      safeSummary: null,
      createdAt: now,
      updatedAt: now,
    }) as RealmModerationQueueItemDTO;
}

function StoryHost({
  isAuthenticated,
  outcome = "success",
  children,
}: {
  isAuthenticated: boolean;
  outcome?: Outcome;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const original = governanceApi.createRealmQueueItem;
    authenticate(isAuthenticated);
    mockCreateQueueItem(outcome);
    setReady(true);
    return () => {
      governanceApi.createRealmQueueItem = original;
      useAuthSessionStore.getState().reset();
    };
  }, [isAuthenticated, outcome]);
  if (!ready) return null;
  return <div className="p-12">{children}</div>;
}

const meta = {
  title: "App/Engagement/ReportAction",
  component: ReportAction,
  decorators: [withRouter],
} satisfies Meta<typeof ReportAction>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Signed-out: opening the dialog offers a sign-in prompt, not the report form. */
export const SignedOut: Story = {
  render: () => (
    <StoryHost isAuthenticated={false}>
      <ReportAction target={TARGET} realmUnitId={REALM_UNIT_ID} />
    </StoryHost>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    // No reason field for signed-out users; a sign-in link is offered instead.
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("link")).toBeInTheDocument();
  },
};

/** Allowed: signed-in members see the reason form. */
export const Allowed: Story = {
  render: () => (
    <StoryHost isAuthenticated>
      <ReportAction target={TARGET} realmUnitId={REALM_UNIT_ID} />
    </StoryHost>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
    await waitFor(() =>
      expect(screen.getByRole("textbox")).toBeInTheDocument(),
    );
  },
};

/** Rate-limited: submission surfaces an inline policy denial, not a toast. */
export const RateLimited: Story = {
  render: () => (
    <StoryHost isAuthenticated outcome="rate-limited">
      <ReportAction target={TARGET} realmUnitId={REALM_UNIT_ID} />
    </StoryHost>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
    const textbox = await screen.findByRole("textbox");
    await userEvent.type(textbox, "This is spam");
    const dialog = within(screen.getByRole("dialog"));
    const submit = dialog.getAllByRole("button").at(-1);
    if (submit) await userEvent.click(submit);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  },
};

/** Submitted: a successful report swaps the form for a confirmation. */
export const Submitted: Story = {
  render: () => (
    <StoryHost isAuthenticated outcome="success">
      <ReportAction target={TARGET} realmUnitId={REALM_UNIT_ID} />
    </StoryHost>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
    await screen.findByRole("textbox");
    const dialog = within(screen.getByRole("dialog"));
    const submit = dialog.getAllByRole("button").at(-1);
    if (submit) await userEvent.click(submit);
    // The reason form is replaced by the confirmation state.
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
  },
};

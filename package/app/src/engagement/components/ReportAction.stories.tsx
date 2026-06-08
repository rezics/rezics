import { ApiError } from "@rezics/api";
import { governanceApi } from "@rezics/api/governance/governance.api";
import type { ModerationCaseDTO, Permission } from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode, useEffect, useState } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";

import { withRouter } from "@/stories/decorators/withRouter";
import { useAuthSessionStore } from "@/user/states";
import { ReportAction } from "./ReportAction";

const REALM_UNIT_ID = "realm-fixture";
const TARGET = { kind: "unit", id: "unit-post-1" } as const;
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

function mockCreateRealmCase(outcome: Outcome) {
  if (outcome === "rate-limited") {
    governanceApi.createRealmCase = async () => {
      throw new ApiError(429, "RATE_LIMITED", "Too many reports");
    };
    return;
  }
  governanceApi.createRealmCase = async (realmUnitId) =>
    ({
      id: "case-story-1",
      scope: "realm",
      state: "new",
      severity: null,
      reporterUserId: "story-user",
      subjectUserId: null,
      target: { ...TARGET, realmUnitId },
      sourceFeedbackId: null,
      assignedToUserId: null,
      parentCaseId: null,
      duplicateOfCaseId: null,
      reason: "Story report",
      safeSummary: null,
      createdAt: now,
      updatedAt: now,
    }) as ModerationCaseDTO;
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
    const original = governanceApi.createRealmCase;
    authenticate(isAuthenticated);
    mockCreateRealmCase(outcome);
    setReady(true);
    return () => {
      governanceApi.createRealmCase = original;
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

/**
 * Signed-out: opening the dialog offers a sign-in prompt, not the report form.
 * 未登录：打开对话框会提供登录提示，而非举报表单。
 */
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
    // 未登录用户没有理由输入框；改为提供登录链接。
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("link")).toBeInTheDocument();
  },
};

/**
 * Allowed: signed-in members see the reason form.
 * 允许：已登录成员可看到理由表单。
 */
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

/**
 * Rate-limited: submission surfaces an inline policy denial, not a toast.
 * 限流：提交时以内联策略拒绝形式展示，而非 toast。
 */
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

/**
 * Submitted: a successful report swaps the form for a confirmation.
 * 已提交：举报成功后表单被替换为确认状态。
 */
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
    // 理由表单被确认状态替换。
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
  },
};

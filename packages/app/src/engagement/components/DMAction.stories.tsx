import { subscriptionCheckQuery } from "@rezics/contract/api/subscription/subscription";
import type { Permission } from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";
import { expect, screen, userEvent, waitFor } from "storybook/test";

import { withRouter } from "@/stories/decorators/withRouter";
import { useAuthSessionStore } from "@/user";
import { DMAction } from "./DMAction";

const PEER_ID = "user-peer-1";

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

function StoryHost({
  isAuthenticated,
  subscribed,
  withDmChannel,
  children,
}: {
  isAuthenticated: boolean;
  subscribed: boolean;
  withDmChannel: boolean;
  children: ReactNode;
}) {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    authenticate(isAuthenticated);
    qc.setQueryData(subscriptionCheckQuery(PEER_ID).queryKey, {
      subscribed,
      channels: withDmChannel ? ["dm.message"] : ["post.new"],
    });
    setReady(true);
    return () => {
      qc.clear();
      useAuthSessionStore.getState().reset();
    };
  }, [isAuthenticated, subscribed, withDmChannel, qc]);
  if (!ready) return null;
  return <div className="p-12">{children}</div>;
}

const meta = {
  title: "App/Engagement/DMAction",
  component: DMAction,
  decorators: [withRouter],
} satisfies Meta<typeof DMAction>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Eligible: subscribed with the DM channel — renders a link to the inbox.
 * 符合条件：已订阅且包含 DM 频道 —— 渲染指向收件箱的链接。
 */
export const Eligible: Story = {
  render: () => (
    <StoryHost isAuthenticated subscribed withDmChannel>
      <DMAction peerUserId={PEER_ID} peerName="Lin" />
    </StoryHost>
  ),
  play: async () => {
    await waitFor(() => expect(screen.getByRole("link")).toBeInTheDocument());
  },
};

/**
 * Not DM-eligible: subscribed without the DM channel — disabled with a reason.
 * 不符合 DM 条件：已订阅但不含 DM 频道 —— 禁用并附带原因。
 */
export const Ineligible: Story = {
  render: () => (
    <StoryHost isAuthenticated subscribed withDmChannel={false}>
      <DMAction peerUserId={PEER_ID} peerName="Lin" />
    </StoryHost>
  ),
  play: async () => {
    const button = await screen.findByRole("button");
    expect(button).toBeDisabled();
    await userEvent.hover(button);
  },
};

/**
 * Signed-out: the action is not offered at all.
 * 未登录：完全不提供该操作。
 */
export const SignedOut: Story = {
  render: () => (
    <StoryHost isAuthenticated={false} subscribed={false} withDmChannel={false}>
      <DMAction peerUserId={PEER_ID} peerName="Lin" />
    </StoryHost>
  ),
  play: async () => {
    await waitFor(() => {
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.queryByRole("link")).toBeNull();
    });
  },
};

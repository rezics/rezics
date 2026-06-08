import {
  governanceCaseListQuery,
  governanceRealmCaseListQuery,
} from "@rezics/api/governance/governance";
import { governanceApi } from "@rezics/api/governance/governance.api";
import type { ModerationCaseDTO } from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { withRouter } from "@/stories/decorators/withRouter";
import { useAuthSessionStore } from "@/user";
import { StaffConsolePage } from "./StaffConsolePage";

const REALM_UNIT_ID = "realm-library-east";
const ACCOUNT_USER_ID = "user-under-review";

const now = "2026-05-27T08:30:00.000Z";

const openCases: ModerationCaseDTO[] = [
  {
    id: "case-1001",
    scope: "platform",
    state: "new",
    severity: "high",
    reporterUserId: "reporter-1",
    subjectUserId: ACCOUNT_USER_ID,
    target: { kind: "unit", id: "unit-post-91" },
    sourceFeedbackId: "feedback-21",
    assignedToUserId: null,
    parentCaseId: null,
    duplicateOfCaseId: null,
    reason: "Repeated harassment reports on a discussion thread.",
    safeSummary: "Thread needs staff review.",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "case-1002",
    scope: "platform",
    state: "assigned",
    severity: "medium",
    reporterUserId: "reporter-2",
    subjectUserId: "user-42",
    target: { kind: "unit", id: "unit-review-33" },
    sourceFeedbackId: null,
    assignedToUserId: "staff-lin",
    parentCaseId: null,
    duplicateOfCaseId: null,
    reason: "Potential review spam cluster.",
    safeSummary: null,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "case-1003",
    scope: "platform",
    state: "actioned",
    severity: "low",
    reporterUserId: null,
    subjectUserId: "user-57",
    target: { kind: "account", id: "user-57" },
    sourceFeedbackId: null,
    assignedToUserId: "staff-lin",
    parentCaseId: null,
    duplicateOfCaseId: null,
    reason: "Account warning was issued.",
    safeSummary: "Action completed.",
    createdAt: now,
    updatedAt: now,
  },
];

const realmCases: ModerationCaseDTO[] = [
  {
    id: "case-7001",
    scope: "realm",
    state: "new",
    severity: "medium",
    reporterUserId: "realm-reporter",
    subjectUserId: ACCOUNT_USER_ID,
    target: { kind: "unit", id: "unit-post-91", realmUnitId: REALM_UNIT_ID },
    sourceFeedbackId: "feedback-22",
    assignedToUserId: null,
    parentCaseId: "case-1001",
    duplicateOfCaseId: null,
    reason: "Realm moderators escalated this thread for site staff review.",
    safeSummary: "Escalated from realm case.",
    createdAt: now,
    updatedAt: now,
  },
];

type ConsoleStoryState = "loading" | "denied" | "empty" | "error" | "actions";

function setStaffAuth(state: ConsoleStoryState) {
  if (state === "loading") {
    useAuthSessionStore.setState({
      ...useAuthSessionStore.getState(),
      status: "loading",
      error: null,
    });
    return;
  }

  useAuthSessionStore.setState({
    ...useAuthSessionStore.getState(),
    status: "ready",
    auth: {
      session: null,
      user: null,
      role: null,
      hasIdentity: true,
    },
    rezics: {
      userId: "story-staff",
      permission: { role: "MEMBER" },
      governanceCapabilities:
        state === "denied"
          ? []
          : [
              {
                capability: "moderation.case.triage",
                scope: { kind: "global" },
              },
              {
                capability: "audit.read",
                scope: { kind: "global" },
              },
            ],
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
    capabilityLevel: "member",
    error: null,
  });
}

function seedConsoleQueries(
  queryClient: QueryClient,
  state: ConsoleStoryState,
) {
  queryClient.clear();
  queryClient.setQueryDefaults(["governance"], { retry: false });

  if (state === "empty") {
    queryClient.setQueryData(
      governanceCaseListQuery({ limit: 50 }).queryKey,
      [],
    );
  }

  if (state === "actions") {
    queryClient.setQueryData(
      governanceCaseListQuery({ limit: 50 }).queryKey,
      openCases,
    );
    queryClient.setQueryData(
      governanceRealmCaseListQuery(REALM_UNIT_ID, { limit: 25 }).queryKey,
      realmCases,
    );
  }
}

function useStorySetup(state: ConsoleStoryState) {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const originalListCases = governanceApi.listCases;

    setStaffAuth(state);
    seedConsoleQueries(queryClient, state);

    if (state === "error") {
      governanceApi.listCases = async () => {
        throw new Error("Storybook case list failure");
      };
    }

    setReady(true);

    return () => {
      governanceApi.listCases = originalListCases;
      queryClient.clear();
      useAuthSessionStore.getState().reset();
    };
  }, [queryClient, state]);

  return ready;
}

function ConsoleStory({ state }: { state: ConsoleStoryState }) {
  const ready = useStorySetup(state);
  if (!ready) return null;

  return (
    <StaffConsolePage
      initialRealmUnitId={state === "actions" ? REALM_UNIT_ID : ""}
      initialAccountUserId={state === "actions" ? ACCOUNT_USER_ID : ""}
    />
  );
}

const meta = {
  title: "App/Staff/Console",
  component: StaffConsolePage,
  decorators: [withRouter],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof StaffConsolePage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => <ConsoleStory state="loading" />,
};

export const Denied: Story = {
  render: () => <ConsoleStory state="denied" />,
};

export const EmptyQueue: Story = {
  render: () => <ConsoleStory state="empty" />,
};

export const QueueError: Story = {
  render: () => <ConsoleStory state="error" />,
};

export const ActionableQueue: Story = {
  render: () => <ConsoleStory state="actions" />,
};

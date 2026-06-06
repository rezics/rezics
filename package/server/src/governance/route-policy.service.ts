import type {
  PolicyAction,
  PolicyDecision,
  PolicyInput,
  PolicyTargetRef,
  RezicsSessionClaims,
} from "@rezics/contract";
import { governanceCapabilityService } from "./capability.service";
import { governanceEnforcementService } from "./enforcement.service";
import { decide } from "./policy";

export class GovernanceRoutePolicyService {
  async decideForIdentity(input: {
    identity: RezicsSessionClaims;
    action: PolicyAction;
    target?: PolicyTargetRef;
    realmMembership?: PolicyInput["realmMembership"];
  }): Promise<PolicyDecision> {
    const [capabilities, activeEnforcement] = await Promise.all([
      governanceCapabilityService.resolveForUser(input.identity.userId),
      governanceEnforcementService.activeSummary(input.identity.userId),
    ]);

    return decide({
      actorUserId: input.identity.userId,
      permission: input.identity.permission,
      action: input.action,
      capabilities,
      activeEnforcement,
      realmMembership: input.realmMembership,
      target: input.target ?? null,
    });
  }
}

export const governanceRoutePolicyService = new GovernanceRoutePolicyService();

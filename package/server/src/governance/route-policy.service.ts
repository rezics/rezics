import type {
  PolicyAction,
  PolicyDecision,
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
      target: input.target ?? null,
    });
  }
}

export const governanceRoutePolicyService = new GovernanceRoutePolicyService();

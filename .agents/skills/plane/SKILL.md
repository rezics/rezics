---
name: plane
description: Make one visible result work from end to end across two or more technical domains. Use when meaning and guarantees must pass through boundaries such as UI, API, services, data, infrastructure, or observability, so no single domain can prove the full result. Set the rules at each boundary, the safe order for old and new versions, integration, migration, and end-to-end proof. Use it with point for local causes and line for shared rules inside each domain.
---

# Plane

## Think from the end through the full path

Start with the final state seen by a person or system. Work back through every technical domain and through release time. Give special care to boundaries, handoffs, and states with old and new versions together. Every part may work by itself while the full result still fails. Build the shortest full path to proof before you make one domain perfect.

Ask: What must be seen at the end? Where can meaning, control, or a guarantee be lost? Which part-done or old-and-new state can break the result? What is the smallest full path that can prove it?

## Make the full path work

1. Name who or what sees the result. State the old result, the new result, the final state, and one full acceptance case.
2. Work back through the paths for control, data, identity, authority, and failure. Mark the main source of truth, security and trust boundaries, asynchronous work that happens later, actions that cannot be undone, and the tools and places used to run and watch the system.
3. Set the rule at each boundary before changing local parts. Cover meaning, data form or schema, owner, state changes, what errors mean, compatibility, and needed retry or idempotency behavior.
4. See rollout and rollback as changes from one state to another. Put addition, migration, rule enforcement, and removal in an order that keeps old-and-new states safe or makes them stop safely.
5. Join the smallest full path through all needed domains. Use line to set shared rules inside each domain. Use point to answer local questions about cause and effect.
6. Test the weakest boundaries for needed permissions, part failure, work at the same time, recovery, observability (logs, measures, and traces), and migration cases. Add only what the result and risk need.
7. Run the full acceptance case at the highest practical level. Also test the rules at each boundary, because one passing full test may hide parts that do not agree. If a full run is not possible, give clear proof at every boundary and name the gap that remains.
8. Report the visible result, boundary rules, rollout choices, the state of each technical domain, end-to-end proof, and release risks.

## Stop or use another view

- Stop when one full case proves the result, every boundary has a clear rule, old-and-new states are safe or blocked, and all remaining gaps are visible.
- Use line when one shared rule can be set and proved inside one technical domain. Use point for a local question without losing the full path.
- Use the skills as views inside one process, not as three full lists. Plane sets the end result. Line keeps shared rules true. Point finds local causes. Explore, make changes, check, and report once. Keep all limits from all active skills. Show any conflict and ask for a decision.

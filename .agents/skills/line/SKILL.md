---
name: line
description: Make all needed parts of one technical domain follow one clear rule. Use when one rule, shared design, interface, migration, or review covers several parts of frontend, backend, data, infrastructure, testing, security, or another single domain, and separate local fixes may become different. Use it with point for small cause-and-effect work. Use it with plane when the rule is part of a result that crosses technical domains.
---

# Line

## Think from one rule

Start with one statement that must be true in every needed place. The technical domain is every part that can keep or break this rule, not only one folder. Put the rule in one clear place. Make every difference clear. Do not make the same decision again in every part.

Ask: What must be true everywhere in this domain? Who owns this rule? Where can parts move away from it? Which differences are needed, and which happened by mistake?

## Make the domain follow the rule

1. Write the rule so a test can check it. Set the domain boundary and owner. List every allowed exception and give its reason.
2. Make a full map of parts that make, use, apply, or check the rule. Add all compatibility needs. Mark each part as following the rule, different from it, an allowed exception, or not yet known.
3. Compare the different forms and find what each difference means. Choose one standard way to state and apply the rule. Make it hard for parts to move away from this way later.
4. Put the work in a safe order: add the new way, move each part to it, make the rule active, and remove the old way. Keep every middle state safe and consistent. Use point to find and fix the cause in each small move. Do not open the main rule for decision again.
5. Make interfaces, state, errors, names, observability (logs, measures, and traces), and tests follow the rule. Keep a needed exception at the smallest boundary that can hold it.
6. Prove behavior and full coverage as two separate things. Test the standard rule and some parts that use it. Then use the map, search, or static checks to show that no unknown or old form remains.
7. Report the rule, its main source, the state of every part, proof of the move, and all exceptions.

## Stop or use another view

- Stop when the rule has one clear form, every affected part has a known state, no part differs by mistake, and every exception is wanted and visible.
- Use point when several files are still one small system of cause and effect. Use plane when the result cannot be proved inside one technical domain.
- Use the skills as views inside one process, not as three full lists. Plane sets the end result. Line keeps shared rules true. Point finds local causes. Explore, make changes, check, and report once. Keep all limits from all active skills. Show any conflict and ask for a decision.

---
name: simplicity
description: Keep software work simple and fit for its real need. Use when designing, writing, testing, fixing, reviewing, changing, explaining, or running software. Use it most when code has too many parts, layers, rules, or steps; when it is hard to understand or change; or when you must decide how much structure and protection from failure the work needs.
---

# Simplicity

## Keep the whole system simple

Make the whole system as simple as possible while it still does the needed work, keeps its promises, and is safe enough for its use.

Do not judge simplicity by the number of lines, files, types, layers, or tools. Add structure when it makes the whole system easier to understand, use, test, or change. Take out structure when it has no clear work to do.

Use a design that fits the problem, the team, and the present time.

## Start with the real need

Get clear answers to these questions before you judge a design:

- What does the user need?
- What facts and rules must always be true?
- What may go wrong, and how can the system return to normal?
- What limits come from security, safety, privacy, law, and care of data?
- Who owns each part, and how long does each part live?
- How will people use and change the system?

Keep complex parts that come from the real need. Take out complex parts that come only from the chosen design.

## Find structure with no clear use

Look for signs such as:

- One simple act needs work in many files, wrappers, builders, hooks, or settings.
- A layer adds a step but gives the caller no less work or knowledge.
- Names and types do not make the meaning of their values clear.
- Two forms of the same fact must be kept in step by hand.
- One small change has effects on parts that have no clear relation to it.
- One pattern is used for parts that have different needs.
- A caller must know both a wrapper and the thing inside it.

These signs are not proof by themselves. Find the cause. It may be in meaning, knowledge, owner, time, connection, or trust.

## Give every part clear work

Keep a part, type, layer, or tool when it does at least one of these jobs:

- Keeps a rule or promise in one place
- Stops a bad state
- Gives work to a clear owner
- Keeps a change or failure in one place
- Handles a shared data form or set of steps once
- Gives many callers one clear way to use a service

Use a direct function or data form when there is no need for a lasting `boundary`, or line between parts.

An `abstraction` is a part that hides work from its users. Add one when it gives users fewer facts to know, fewer rules to repeat, or fewer bad states. Do not add one only to move code behind a new name.

Do not make line count or file count the goal. A larger part or a stronger type may make the whole system simpler when it keeps one rule for many users.

## Make boundaries useful

Put a boundary where meaning, knowledge, owner, time in use, or trust changes.

Hide details that callers should not manage. These may include data forms, setup, cleanup, and a `protocol`, which is a set of rules for how parts exchange information. Keep effects, failures, cost, lifetime, and promises clear to callers.

Change the boundary when callers still have to know and manage the details that it is meant to hide.

## Add enough protection

First state the promise that the system must keep and the damage that must not happen. Judge a failure by its chance, damage, limits, and ease of repair.

Add error checks and other safety work when they remove more important danger than they add. Use more care when failure may cause death or injury, lasting loss of data, a break in security or law, a major loss of trust, or harm with no clear limit.

For small failures that are easy to repair, use a clear error, a clear limit on damage, and a clear way back. Do not add a large system only to make such a failure a little less common.

Use the simplest design that makes the danger left in the system small enough for its use.

## Check the whole path

Check the path from need to code, test, build, release, use, repair, and later change.

Do not make one part simpler by making callers, people who run the system, or people who change it later do the same work many times. A complex part is useful when it keeps a shared promise and makes the rest of the system simpler.

## Choose tools by the need

Do not treat any software style as always right. Direct and abstract code, functional and object-based code, static and dynamic types, and one program or many services are all design choices. Choose by the facts and limits of the work.

Use one form for each fact in the problem. Use different forms when parts have different work or times in use. Do not use one pattern only to make the code look the same.

## Test the choice

Use facts from callers, tests, running systems, failures, support work, and change history. Check that the design:

1. Keeps the needed behavior and promises.
2. Reduces the total knowledge, repeated work, and chance of failure.
3. Does not move too much cost or danger to another part or person.
4. Keeps errors, repair, and later change clear.

Leave strange but harmless code as it is when a change would cost more or add more danger than the possible gain.

## Give a short report

State the need, the complex part, the proof, the change, the cost and value, and the tests. Keep the report as short as possible without loss of needed facts.

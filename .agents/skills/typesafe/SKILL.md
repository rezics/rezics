---
name: typesafe
description: "Use TypeSafe thinking whenever writing or changing TypeScript. Show all needed values, states, rules, and failures; give every stronger type a proof; allow only safe operations; and keep the type guarantee safe from its source to its final use. Use for implementation, refactoring, API and data-flow design, integration, migration, review, debugging, compiler settings, declarations, and generated types."
---

# TypeSafe

## Build type safety into the code

Use type safety while writing the code. Do not wait for a later review. Do not take "no compiler errors" as proof that the code is safe.

A **type guarantee** is a fact that other checked code may safely use.

> **Keep meaning, runtime value, static type, data form, and allowed operations in agreement. Never let code use a stronger type guarantee than its proof allows.**

Use this rule at two levels:

- In each place, give the value a true type and allow only operations that are safe for that type.
- Along the full path, keep the guarantee safe from the first source to the final effect.

Use this rule for the full path:

> **End-to-end type safety = correct origin AND complete propagation AND correct consumption.**

Here, **origin** is where the typed path starts, **propagation** is every step in the path, and **consumption** is the final use.

A **boundary** is a point where data moves between code, systems, trust levels, data forms, or versions.

Keep both levels safe. A good local type is not enough if a boundary drops part of its meaning. A full path is not enough if its type is false or too weak to stop a wrong use.

Before writing local code, answer these questions:

- What must the program do?
- Which values and states are possible?
- Which states must not be used?
- Which rules must stay true?
- Which operations and state changes are safe?
- Where do the facts come from, and what proves them?
- Which functions, modules, systems, data forms, and points in time are on the path?
- What facts does the final use need?

Use only as much process as the risk needs, but do not skip a question.

## Keep five parts together

Keep these five parts clear at each important point:

1. **Meaning:** what the value means in the work the program does.
2. **Runtime value:** what is there when the code runs.
3. **Static type:** what the TypeScript compiler sees before the code runs.
4. **Data form:** the form used in memory, over a link, in storage, or in another version.
5. **Proof:** the fact, rule, or check that joins the type to the runtime value.

Make the five parts agree. Treat a TypeScript type as a statement that the compiler accepts from the facts it can see. Do not treat it as a runtime fact.

Remember what the compiler can and cannot do:

- Compiler settings, declaration files, generated types, generic links, and ways around the checker all change what it may accept.
- TypeScript removes types when the code runs.
- TypeScript allows some unsafe type links.
- TypeScript checks data shape, but it cannot prove what the data means in the real work.

Get a runtime check or another trusted proof when a fact comes from outside checked code.

Keep safety separate from ease and detail:

- Never give a value a type stronger than its proof.
- Keep missing knowledge in the type until there is proof.
- Add more detail when later code needs it and proof supports it.
- Do not take the same data shape as proof of the same meaning.
- Do not keep a narrow type after other code, a callback, or an `await` may have changed the value.

## Show the full contract

Show every state and rule that can change what the program must do. Do not model only the fields that are easy to type.

- Include success, no value, failure, and each important state before and after a change.
- Keep two meanings apart when they need different actions, even if their data has the same shape.
- Show needed links between inputs, outputs, object members, and state changes.
- At a boundary you own, stop code from making a bad state or doing a bad operation.
- Show facts that are not yet known instead of hiding them with an easy type.
- Keep one main source for a shared fact. Make other types from it, or check that they still agree.

Do not make a type too strong or too wide for its job. A false rule is unsafe. A type that is too wide may lose a useful fact and let code mix meanings.

An **invariant** is a rule that must stay true. If TypeScript cannot show an invariant, keep it true when making the value or with a runtime check. State any rule that still has no proof.

Use each function, method, and module type as a **contract**. A contract says what facts the input must have and what facts the output will have.

- Ask for only the input facts the code needs.
- Promise only the output facts the code makes true.
- Keep important links between input and output types.
- Show success, no value, failure, and state change where later code needs to act on them.
- Give code only the power to change data that the operation needs.

Judge a contract by the bad programs it stops, not by how good its names sound.

## Give every stronger type a proof

Make a type stronger only through one of these sources:

- checked code that makes the value;
- a type the compiler gets from facts that already have proof;
- a runtime check;
- another clear and trusted source of truth.

Follow the proof each time the type gets stronger.

- Keep input `unknown` while it has no proof.
- Treat `any` and comments that hide compiler errors as a loss of static proof.
- Treat `as`, `!`, a generic type chosen by the caller, and a hand-written type guard as statements that still need proof.
- Let a runtime check prove only what it checks.
- Let the compiler carry known facts. Do not let it seem to make runtime facts.
- Get new proof when the old proof no longer covers the value because the code, time, trust, or version has changed.

An **escape hatch** is code that goes around the type checker. When one is needed, keep it at the smallest boundary. Say why it is safe. Return at once to a type that has proof. Do not let an unchecked statement become a hidden rule for the rest of the program.

## Keep every operation safe

Make every creation, branch, call, data change, and state change keep the rule it promises. For each operation, keep these facts clear:

- the guarantee before the operation;
- the action at runtime;
- every state and data form the action can make;
- the guarantee after the operation;
- the proof that joins the before and after states.

The type may change along the way. It may get narrower after a check, wider after a real loss of detail, or different after a real change of form. Do not make the whole path use one type or one data form.

Keep every fact and difference that later code needs. Do not drop meaning without making the loss clear. Do not say a fact is certain without proof.

Make a bad operation impossible to write, or reject it at the first checked interface that knows enough. If an operation can fail, change state, or make a guarantee weaker, make the next code see that result.

## Keep type safety from start to end

Apply the same rules to the full value path.

### Start with a correct origin

At the first typed point, use no stronger type than the way the value was made or the proof supports. Make the source type include every important value the source can give.

For a value made inside checked code, follow its inputs and the rules used to make it. Start data from users, networks, files, databases, environment settings, untyped libraries, or other running systems without proof. Give it a stronger type only after a runtime check or another trusted proof.

### Keep complete propagation

At every step, join the input guarantee to the output guarantee. Include function calls, data changes, encoding and decoding, storage, queues, caches, work done later, and moves between versions.

Static proof cannot by itself cross a process or trust boundary. Check the data again where needed. Check old stored data and other running versions against the current rule. Carry no value and failure through the path as carefully as success.

Do not let a type that is too wide, a wrong declaration, or a wrong data form break the chain.

### Use the final value correctly

Write the final code for the type and meaning that arrive, not for a stronger type that would be easier to use.

Handle every state that can arrive. Make a type narrower only with proof. Meet every fact the final operation needs. Keep meanings apart. Do the right action for the value.

If the final operation needs a stronger guarantee, make that guarantee earlier or get new proof at the final point. Do not use `as` to rebuild a guarantee that was lost.

Correct use means correct behavior for every value the path may safely give. It does not mean only that property access works.

## Work from rule to result

1. State the wanted result, the full set of states, the rules that must stay true, and the ways work can fail.
2. Find the source, proof, trust boundaries, and final use for each value.
3. Make types and interfaces that allow good states and stop bad operations.
4. Write the source and each operation so its runtime result supports its output type.
5. Keep the guarantee safe through every data form, boundary, and version to final use.
6. After each change, follow the changed guarantee from its first fact to its final effect.
7. Fix a weak or false guarantee at the first point where proof is missing. Do not hide it later with `as`.

Choose libraries, schemas, generated code, and system design only after you know which type rule they must make or keep. Judge each tool by the proof and limits it adds, not by its name.

## Check while writing

Use checks to confirm the safety you built. Do not use them in place of safe design. While writing, ask:

- Can a runtime value have a state that its type says is not possible?
- Can the types make a bad state or allow a bad operation?
- Can an operation break a rule but keep the old type?
- Can a step lose a needed fact or add a fact with no proof?
- Can the final code compile but do the wrong action for a value that may arrive?

Match each check to the fact it must prove:

- Use the compiler and type tests for static type links.
- Use runtime checks for facts from untyped data.
- Use behavior tests for operations and rules.
- Use data-form and version tests for boundaries.
- Check the final result for correct use.

Finish only when the types show all needed states, every stronger type has proof, every allowed operation keeps its contract, and one safe chain runs from each source through every step to the right final use. State every rule that still has no proof, and make the safety claim no stronger than those rules allow.

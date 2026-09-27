# Give each Sample request its own identity, so a key scope can carry more than one

- Issue: [#31](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/31)
- Status: Ready for agent
- Related decisions: ADR-0003, ADR-0009
- Depends on: [#32](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/32), which adds a Writing Task 1 Sample request
- Broader design: [Sample request and Writing Scoring catalog](https://github.com/AiHub-Ecosystem/AiHub-Frontend/blob/dev/docs/superpowers/specs/2026-09-27-sample-request-design.md)

## Problem Statement

An API key scope names a capability, and one capability can cover more than one thing a customer can call. The Writing scope covers grading a Task 2 essay and grading a Task 1 chart description, and both are requests a holder should be able to see, understand, and run.

The Sample request cannot express that today. It shows one tab per API key scope, and the scope is not only which samples get built — it is also how a tab identifies itself. Selecting a tab compares scopes, the list is keyed by scope, and every element id in the tab and its panel is built from a different field that happens to hold one value per scope. A key allowed both Writing requests would produce two samples sharing one scope, and the tab list would break: the two tabs would both claim to be selected, both would be in the tab order, and their element ids would collide.

The label has the same problem from the other side. A tab's name is read from the scope catalog, so both Writing requests would be called "Writing" and a holder could not tell them apart.

None of this is visible to anyone yet, because the Console cannot produce a key that would hit it. That is the point: the cost of a second Writing Sample request is paid now, in a refactor that changes nothing on screen, rather than later, in a feature that changes what people see.

## Solution

Give every Sample request an identity of its own, separate from the API key scope it belongs to, and use that identity everywhere a Sample request is currently identified.

One field carries that identity, and it is the one the element ids already use. The API key scope stays, but only as the condition that decides whether a Sample request is built at all. Each Sample request carries its own label instead of reading one from the scope catalog. One scope may then produce several Sample requests, listed in a fixed order that does not depend on the order the key's scopes arrive in.

A holder sees exactly what they see today: the same tabs, in the same order, under the same names, with the same content. What changes is that the Console is now able to show a second request for a scope it already shows one for.

## User Stories

1. As an API-key holder, I want the Sample request tabs to stay exactly as they are today, so that this work does not change anything I use.
2. As an API-key holder, I want a scope to be able to offer more than one request, so that every request my key can make is reachable from the reveal dialog.
3. As a future maintainer, I want each Sample request to have one identity that everything else derives from, so that adding a second request for a scope cannot half-work.
4. As a future maintainer, I want the API key scope to mean only "is this built", so that it is never mistaken for something that identifies a request.
5. As a future maintainer, I want a Sample request to carry its own label, so that two requests of one scope are not shown under the same name.
6. As a keyboard user, I want the tab list to expose exactly one selected tab, so that assistive technology does not announce a set of tabs where several are current.
7. As a keyboard user, I want exactly one tab in the tab order at a time, so that arrowing through tabs moves one step each time.
8. As a user of assistive technology, I want each tab and its panel to have a unique pair of element ids, so that a control is never claimed by two tabs.
9. As an API-key holder, I want the Writing request's name to stay "Writing", so that this refactor is invisible.
10. As a future maintainer, I want the Sample request builder to be a flat list with one entry per request, so that adding a request is adding a line rather than reshaping a nested structure.
11. As a future maintainer, I want the display order of requests to be the order they are declared, so that adding a request cannot silently reorder the ones already there.
12. As a future maintainer, I want the builder to hold one description of a request's body fields, so that a request is described once rather than once per output type.
13. As a reader of the public API reference, I want the Writing Task 1 example to come from one place, so that the reference and the Console cannot end up teaching different contracts.
14. As a reader of the public API reference, I want the Writing Task 1 page to render exactly as it does today, so that extracting the example changes nothing.
15. As a maintainer, I want the design documentation to stop saying one tab per scope, so that the next reader is not misled by a rule the code no longer follows.
16. As a maintainer, I want the reason a request is identified by its own field rather than by its scope recorded next to that field, so that the choice is explained where it is read.
17. As a maintainer, I want this issue to add no tab and no new request, so that the observable surface only changes when a request actually arrives.

## Acceptance Criteria

- [ ] Every Sample request carries an identity that is unique per request, and it is the only thing the Console derives the selected tab, the list key, the tab element id, the panel element id, and their aria references from.
- [ ] One API key scope can produce several Sample requests, and the requests belonging to a scope appear in a fixed declared order that does not depend on the order the key's scopes arrive in.
- [ ] The API key scope survives only as the condition that decides whether a Sample request is built, and is never used to identify one.
- [ ] Each Sample request carries its own display label rather than reading one from the API key scope catalog, and the helper that read a label from the catalog is gone.
- [ ] The builder holds one description of a body field rather than a separate output type per request kind, because the only remaining difference between them was a required flag the renderer already treats identically.
- [ ] With a key holding both Writing and Speaking, the Console shows the same tabs, in the same order, under the same names, with the same content as before.
- [ ] The display name attached to a scope in the scope catalog is left in place, because the create form still uses it to explain an unavailable entitlement.
- [ ] The selected tab, the list key, and every tab and panel element id are derived from the request's own identity rather than from its scope. This is the condition that makes the tab attributes unique; the rendered proof that exactly one tab is selected is covered by #32, where a key with two requests for one scope exists.
- [ ] The body field type no longer names the fields of one specific request, so a second Writing request is not rejected by the type system.
- [ ] The Writing Task 1 request example has a single source of truth shared by the API reference and the Sample request, in the same way the Task 2 example already does.
- [ ] The Writing Task 1 API reference page renders byte-for-byte as it does today. The existing end-to-end coverage of that page pins the example and the field order, and is the proof.
- [ ] No Writing Task 1 builder, tab, or label is added here. Nothing a key holder sees changes.
- [ ] Unit coverage proves that one scope producing several requests yields distinct identities in a fixed order. This test fails if the refactor is done halfway, and does not depend on #32 existing.
- [ ] Unit coverage proves the identities a single key produces are unique, which is what keeps the tab attributes unique.
- [ ] Assertions that identify a tab or a panel by API key scope are updated to the new identity rather than deleted.
- [ ] The design documentation no longer states that there is one tab per scope, and records that a request's identity and its scope are different things.
- [ ] A short comment beside the identity field explains why it, rather than the scope, identifies a request.
- [ ] The idempotency-key predicate is left alone, because it answers a question about the key that must be settled before any Sample request is built.

## Implementation Decisions

- **Identity is the field the element ids already use.** The Sample request type already carries a per-request discriminator, and the tab and panel element ids are already built from it. Promoting that field to be the request's identity completes a half-finished change rather than adding a second identity beside it. Introducing a new identity field next to the existing discriminator would leave two concepts competing for the same job, and every consumer would have to be updated twice.

- **The scope stays, as a build condition.** Each builder knows which scope it belongs to, and the registry still filters on it. Collapsing the scope out of the emitted request would buy a tidier type at the cost of moving information from the result to the registry, where the filter has to rejoin it. The change is one of role, not of content: the scope decides whether a request is built, the identity decides what it is called.

- **One output type, not one per request kind.** The union existed only to type each request's body fields differently. After the body field type stops naming one specific request's fields, the sole remaining difference between the two members was a required flag spelled as a literal on one side and a boolean on the other — and the renderer already treats both the same way. Nothing narrows on the union, and nothing outside the builder imports it. Collapsing it is what frees the identity field to be the identity, without which the first decision above cannot hold.

- **Labels move onto the requests, keeping today's values.** The scope catalog names a capability, and a capability has one name; two requests of one capability need two. The label values stay identical in this issue, so the change is invisible, and the structure is already in place for #32 to name them.

- **A flat registry, one entry per request.** The existing registry is a flat list whose order is already declared rather than derived, and filtering it by scope already works. Making the list a map of scope to several builders would add a flattening step and change nothing about the ordering guarantee.

- **The Task 1 example is extracted here, and not used here.** The Task 2 example exists as a single source of truth because two surfaces need it. Task 1 needs exactly the same thing, and the API reference page has end-to-end coverage that already pins its example and field order — that coverage is the safety net for the extraction, and it is worth taking now rather than later. The module is not dead on arrival: #32 is the next issue and its stated purpose is to consume it.

- **The body field type stops naming one request's fields.** This is a type change with no runtime effect, and it is a precondition for #32 rather than part of this issue's user-facing work. Leaving it locked to one request would mean the refactor created the blockage the next issue has to undo.

- **The idempotency-key predicate is untouched.** It answers whether the key needs a key minted, which must be answered before any Sample request exists, so it cannot be derived from the built requests. It is currently a statement about the Writing scope, and that remains true after this change.

- **No architecture decision record.** The change is easy to reverse, is not surprising once explained beside the field, and is not the result of a trade-off between real alternatives. The reason belongs in a comment at the field, which is where a reader of it will look.

## Testing Decisions

- A good test here proves a property of the builder's output, or proves that a page a customer reads still renders as it did. It does not assert private component state, helper names, or styling structure.

- **Three existing seams. No new test seam is introduced, and no test dependency is added.**

- **Unit, at the Sample request builder.** The central capability of this issue — one scope yielding several requests with distinct identities in a declared order — lives entirely in the builder, and this is the only existing seam that can observe it. A test builds a key whose scopes produce more than one request and asserts the identities are distinct and the order is fixed. It passes once the structure is in place and fails if the change is made halfway, so it does not need #32 to exist to be meaningful. Prior art: the builder tests already cover tab selection by scope, identity readiness, and host resolution, and are the natural home for this.

- **End-to-end, through the Organization API-key page.** Its contribution here is regression, not capability: the existing tests already assert the tab names, their order, the selected tab, and the panel content for a key holding both scopes. They must keep passing unchanged. Assertions that name a tab or a panel by scope are repointed at the new identity.

- **End-to-end, through the public API reference page.** Its coverage already pins the Writing Task 1 example, the request field names and their order, and the response shape. That coverage is what proves the extraction of the example changed nothing, so no new test is written for it — the existing test is the test.

- **What is deliberately not covered here, and why.** The rendered proof that exactly one tab carries the selected state, and only one tab sits in the tab order, needs a key with two requests for one scope. No such key exists and the Console cannot create one yet, so asserting it here would mean either testing unreachable code at a new component-test seam the repository does not have, or asserting something weaker than the claim. The unique identity that makes those attributes unique is proven at the unit seam instead, and #32 adds the rendered assertion when the key exists.

## Out of Scope

- A Writing Task 1 Sample request, its tab, its label, and its builder. That is #32.
- Renaming the Writing tab to distinguish the two requests. The names are unchanged here and change only when a second request appears.
- Changing the idempotency-key behaviour or the UUID lifetime.
- Any change to the API key create form, the Environment choice, the host mapping, or the usage warning.
- Any change to what the public API reference teaches.

## Further Notes

- The issue was written before #27 landed and describes the starting point accurately, but its proposed shape left out three things this work turned on: that the per-request discriminator already generates the element ids, that the body field type is locked to one request's fields, and that the output union is the thing standing between the discriminator and being a real identity. The specification supersedes the original acceptance criteria.
- This issue adds no tab and changes nothing a key holder sees. That is deliberate, and it is why its central capability can only be proven at the unit seam.
- The Writing Task 1 request needs an image the customer supplies, and AIHUB does not host one. That is #32's problem to describe, not this issue's to solve.

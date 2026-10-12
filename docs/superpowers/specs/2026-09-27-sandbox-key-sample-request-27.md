# Sandbox API key and its Writing Sample request

- Issue: [#27](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/27)
- Status: Ready for agent
- Related decisions: ADR-0003, ADR-0004, ADR-0008, ADR-0009
- Broader design: [Sample request and Writing Scoring catalog](https://github.com/AiHub-Ecosystem/AiHub-Frontend/blob/feat/sample-request/docs/superpowers/specs/2026-09-27-sample-request-design.md)

## Problem Statement

AIHUB now offers a free Sandbox Environment that a customer API key can use. Behind it is a real Writing service with a firm monthly allowance, and it does not draw on the Organization's paid allowance. From the Console, none of this exists.

An Organization owner or admin cannot create a Sandbox key: the create form offers a name, API key scopes, and an optional expiry, and it always issues a key for the production Environment. The API key list shows which Environments a key allows, but only ever `production` or `staging`, because the Console cannot produce anything else.

The Sample request makes this concrete. After a key is issued, the Console shows a copyable command for each API key scope that has a known endpoint, so the holder can make a first call without assembling it from separate documentation. That command always points at the production host, and it always carries a warning that the call is real and counts against the Organization's usage. So the first call a new integrator makes is a billable one, against production, before they have any reason to trust the integration.

There is a second, smaller problem in the same place. A key that allows no Environment with a public host has no runnable command, and the Console says so. But the usage warning renders above that decision, so a key with no command at all is still told that a command counts against the Organization's usage.

The documentation states the old boundary as though it still held: the glossary says the Sandbox Environment is never a customer Environment, and the Sample request design justifies a fixed production host by the backend's Environment schema rejecting `sandbox`. The backend changed. The Customer Web's writing of the domain did not.

## Solution

Let an Organization owner or admin create a Sandbox API key from the Console, and let that key's Sample request target the Sandbox host.

The Console offers Sandbox as a choice alongside production when creating an API key. Choosing Sandbox restricts the key to the Writing scope, because the backend accepts no other combination, and the Console says so rather than letting the request fail with a message that names no field. The resulting key's Sample request targets the Sandbox host, offers the Writing tab alone, and carries a warning that the call is free, is not counted against the Organization's paid usage, and is bounded by a monthly allowance.

Rotating a Sandbox key behaves the same way, and the Console states that the allowance belongs to the Organization rather than to the key, so rotation does not reset it.

The glossary and the Sample request design are corrected to record the Sandbox Environment as a customer Environment, and a new ADR records how the Customer Web resolves an Environment to a host and why the Sandbox allowance it displays is static copy.

## User Stories

1. As an Organization owner, I want to create a Sandbox API key, so that I can test a Writing integration without drawing on the Organization's paid usage.
2. As an Organization owner, I want a Sandbox key to be separate from my production key, so that testing does not put my production credential at risk.
3. As an Organization admin, I want to create a Sandbox key, so that I can prepare an integration test without involving an owner for every key operation.
4. As an Organization member, I want key creation to remain restricted to owners and admins, so that membership does not grant credential-management authority.
5. As a key creator, I want a Sandbox key to contain only the Sandbox Environment, so that it cannot be used against production or another tier.
6. As a key creator, I want a Sandbox key to carry only the Writing scope, so that it grants Writing grading without granting Speaking or unrelated operations.
7. As a key creator, I want the form to explain why Speaking is unavailable when I choose Sandbox, so that I understand the restriction rather than wondering whether Speaking is unsupported.
8. As a key creator, I want the form to tell me a Sandbox key is free of charge and bounded, so that I know what I am getting before creating it.
9. As a key creator, I want an invalid combination of Environment and scope refused before I submit, so that I am told which choice was wrong rather than receiving a validation failure that names no field.
10. As a key creator, I want the choices I do not make to keep their current behaviour, so that adding Sandbox to the form does not change how production keys are issued.
11. As an Organization owner, I want to create a Sandbox key without spending a production credential, so that my first call is not a billable one.
12. As an API-key holder, I want my Sandbox key's Sample request to target the Sandbox host, so that copying the command produces a call my key is actually allowed to make.
13. As an API-key holder, I want a Sandbox key to show only the Writing Sample request, so that I am never shown a command for an operation the key cannot perform.
14. As an API-key holder, I want the Sample request to say the call is free and is not counted against the Organization's paid usage, so that I know what running it costs.
15. As an API-key holder, I want the Sample request to state the monthly allowance, so that I know how many free attempts I actually have.
16. As an API-key holder, I want the failure list to explain that an exceeded monthly quota resets at the start of the next month, so that I know whether waiting will help.
17. As an API-key holder, I want a Sandbox key's Sample request after rotating as well as after creating, so that a replacement key is as usable as a new one.
18. As an API-key holder, I want to know the allowance belongs to the Organization rather than to the key, so that I do not rotate to get a fresh allowance.
19. As an API-key holder, I want to run the command in a Bash-compatible shell, so that I can make the first call without reconstructing headers or JSON.
20. As an API-key holder, I want the headers table to show only the API-key prefix while the command carries the full key, so that the table stays safe to inspect while the command stays usable.
21. As an API-key holder whose Organization has no active Identity configuration, I want the Declared User ID example, so that I can run the request in the supported unsigned identity mode.
22. As an API-key holder whose Organization has an active or unknown Identity configuration, I want a User Assertion placeholder and a note, so that I know the value must be signed by the Organization's identity provider.
23. As an API-key holder, I want one idempotency key for the dialog's lifetime, so that rerunning the command replays its stored result instead of grading again.
24. As an Organization owner, I want to tell a Sandbox key from a production key in the key list, so that I know which credential to use.
25. As an Organization owner, I want the key list to name Environments in the Console's own language, so that I do not have to interpret raw identifiers.
26. As an API-key holder, I want no usage warning when there is no command to run, so that I am not told about a cost for a request that does not exist.
27. As a prospective customer, I want the documentation to say the Sandbox Environment is available to customers, so that I know the first call can be free.
28. As a future maintainer, I want the ADR to record how an Environment becomes a host and why that mapping is a constant, so that I understand the coupling before changing it.
29. As a future maintainer, I want the source of the Sandbox allowance figure recorded next to the figure, so that I can tell whether it is still true.
30. As a customer developer, I want the Console to keep the raw key on the one-time path from the BFF, so that showing a Sandbox command does not create a second secret-bearing request.
31. As an API-key holder, I want the command and the raw key gone when I close the dialog, so that a later reveal cannot reuse an earlier credential.
32. As an API-key holder, I want the Sample request and raw key kept out of storage, logs, analytics, and URLs, so that the credential is not exposed outside the dialog.

## Acceptance Criteria

- [ ] The create form offers Sandbox alongside production, and issues `allowed_environments: ["sandbox"]` with `scopes: ["writing.grade"]` when Sandbox is selected.
- [ ] Choosing Sandbox disables the Speaking option and shows one line explaining that a Sandbox key is Writing-only.
- [ ] The form shows one line explaining that a Sandbox key is free of charge and bounded by a monthly allowance.
- [ ] The form refuses an unsupported Environment-and-scope combination before submitting. The backend answers with a single validation message that names no field, so the form cannot delegate this.
- [ ] The BFF accepts `sandbox` in the Environment allowlist it validates create requests against.
- [ ] A Sandbox key's Sample request targets the Sandbox host, and an Environment with no public host still produces no command.
- [ ] A Sandbox key shows the Writing Sample request and no other tab.
- [ ] The usage warning is chosen by Environment: a production key keeps the current wording, and a Sandbox key states that the call is free, is not counted against the Organization's paid usage, and is bounded by a monthly allowance.
- [ ] The Sandbox allowance figure is defined in one place and cites ADR-0009 and the backend's ADR-0056.
- [ ] The Sandbox tab explains that an exceeded monthly quota resets at the start of the next UTC month and does not present it as paid-quota exhaustion.
- [ ] The copy states that the allowance belongs to the Organization, so rotating a key does not reset it.
- [ ] Rotating a Sandbox key produces the same Sandbox Sample request as creating one.
- [ ] The usage warning does not render when no command is shown.
- [ ] The key list names each Environment in the Console's own language rather than joining raw identifiers.
- [ ] The glossary defines the Sandbox Environment as a customer Environment, and states that a Sandbox key allows that Environment alone and carries only the Writing scope.
- [ ] The Sample request design no longer justifies a fixed production host by the backend's Environment schema, and no longer lists a free customer test Environment as needing backend work.
- [ ] A new ADR records Environment selection, host resolution, the constant host mapping and the coupling it accepts, and the static nature of the Sandbox allowance.
- [ ] E2E coverage verifies creating a Sandbox key, rotating a Sandbox key, the Sandbox host in the command, the absence of a Speaking tab, the Environment-specific warning, and the warning staying hidden when no command is shown. Existing assertions that expect a production-only create payload and the current warning text are updated.
- [ ] Unit coverage verifies host selection by Environment, the Writing-only tab set for a Sandbox key, and the Environment-specific warning text.

## Implementation Decisions

- **One issue, not two.** A Sandbox Sample request is unreachable until a Sandbox key can be minted. Rotation is the only other path to a Sandbox key, and it preserves an existing key's Environments rather than choosing new ones, so the form and the command cannot be delivered or verified independently. They are two faces of one feature.

- **Mirror the backend restriction in the form.** The backend accepts a Sandbox key only when the allowed Environments are exactly the Sandbox Environment and the scopes are exactly Writing grading; every other combination is a validation failure carrying one uniform message and no field detail. Server-side validation alone therefore produces an error an owner cannot act on. The Console restricts the choice before submitting.

- **Disable the Speaking option rather than hide it.** The Console already disables a scope the Organization is not entitled to. A Sandbox key is a narrower case of the same interaction, so reusing that pattern keeps one way of explaining an unavailable scope. Hiding the option would remove the explanation along with the option.

- **Resolve the host from the key's Environment through one mapping.** The Sample request builder currently holds one literal per endpoint. Replace those with a single mapping from Environment to public host, consulted once when a command is built. An Environment absent from the mapping has no runnable command, which is the behaviour a staging-only key already needs.

- **Keep the mapping a constant rather than serving hosts at runtime.** A BFF-served host configuration would add a configuration route, a runtime-configuration surface, and their own tests, and would remove only the need to redeploy the Console when a hostname changes. The Customer Web accepts that coupling deliberately: a change to the Sandbox hostname reaches the Console on its own release cycle, and the backend changes it only as an operational decision. ADR-0009 records this trade-off.

- **Choose the usage warning by Environment rather than removing it.** Sandbox calls are not free without limit: the backend enforces a monthly allowance per Organization and a separate allowance across the Sandbox Environment, and calls past either return an exceeded-quota failure. Removing the warning would tell an owner a Sandbox key is unlimited and then surprise them mid-test. The Sandbox warning states what is true: the call is free, is not counted against the paid allowance, and is bounded.

- **State the allowance figure rather than describing it vaguely.** Saying only that a limit exists tells an owner nothing about how many free attempts they have, which is the information the Sandbox Environment exists to give them.

- **Treat the allowance figure as static copy.** The backend exposes it through no endpoint, response body, or header; the only customer-visible signal is an exceeded-quota failure carrying the time to the next UTC month. The figure therefore lives in one Customer Web constant that cites its source. If the backend changes it, the Console is wrong and no test catches it. ADR-0009 records this as accepted drift; closing it would require the backend to expose the allowance, which is a separate change.

- **Do not change rotation.** Rotation sends no request body and the backend preserves the key's Environments, so a rotated Sandbox key is a Sandbox key. No rotation code changes; the rotated key simply resolves through the same mapping.

- **Do not scope the Sandbox tab set from a separate Environment rule.** The tab set already follows the key's API key scopes, and a Sandbox key carries only the Writing scope. The Writing-only result falls out of the existing rule rather than a new one.

- **Widen the BFF Environment allowlist only.** The BFF validates the Environments it accepts on create, and the response parser accepts the value the backend returns. Nothing else in the BFF treats Environments as a closed set.

- **Format the key-list Environments in the Console's language.** The list joins raw identifiers into a table cell in a Vietnamese interface. Sandbox makes that more visible, not new.

- **Fix the unconditional usage warning here.** The warning sits above the decision that produces a command, so a key with no command is still warned about a cost. It is one line in a component this work already changes, and keeping it as its own acceptance criterion keeps it traceable after the Environment-specific warning lands.

- **The raw key path does not change.** Building a Sandbox command needs no request beyond the one-time create or rotate response, so the raw key stays on the one-way path ADR-0003 allows, and nothing new is written to storage, logs, analytics, or URLs.

- **No ADR beyond ADR-0009.** ADR-0003 still governs the one-time reveal, and ADR-0004 and ADR-0008 still govern identity readiness. ADR-0009 is a new record rather than an edit, because ADRs are append-only.

## Testing Decisions

- A good test verifies what a key holder sees or copies — the host in the command, the tabs offered, the warning text, whether a command exists at all — or what the Console actually sent. It does not assert private component state, helper names, or CSS structure, and it does not re-derive a decision the builder already made.

- **Two seams, both existing. No new test seam is introduced.**

- **Unit, at the Sample request builder.** The builder is a pure function from a minted key, identity readiness, and an idempotency key to the set of Sample requests. Everything a key holder sees or copies is decided there, so host selection by Environment, the Writing-only tab set, and the Environment-specific warning text belong in the existing builder unit tests. Prior art: the builder tests already cover production-versus-staging host gating and the identity readiness mapping, so the Sandbox cases extend an existing shape rather than introducing a new one.

- **End-to-end, through the Organization API-key page.** Everything involving the form, the Environment-and-scope restriction, the payload the BFF sends, and the dialog after both creation and rotation is observed here against mocked backend responses. The mock backend echoes the allowed Environments of a create or rotate request back on the key, so widening the BFF allowlist is observable through this seam. Prior art: the existing API-key E2E suite already exercises creation, rotation, the one-time reveal, close behaviour, and the staging-only case where no command is shown. Extend those cases rather than adding a parallel test-only surface.

- **No unit test for the BFF create-request parser.** It has none today, and the end-to-end seam already proves that a Sandbox Environment survives validation and reaches the backend. A third seam would duplicate that proof for no additional confidence, so the parser stays covered only where the value is actually observed.

- Update the existing assertions that pin a production-only create payload and the current usage-warning text rather than deleting them; they become the production-Environment case of the same behaviour.

## Out of Scope

- A Task 1 Sample request. A Sandbox key can grade Task 1 and Task 2, but the Sample request covers Task 2 only, matching the production Sample request. Track separately.
- Speaking in the Sandbox Environment, which the backend does not support.
- Publishing Environment hosts at runtime from the BFF.
- Backend work to expose the Sandbox allowance, and any change to the backend's API key or Environment contract.
- A public staging host. A key allowing only staging continues to have no runnable command.
- Any in-app execution of a Sample request.
- Any change to how a newly issued raw key is revealed, or to Identity Configuration privacy and Organization Roster shape.

## Further Notes

- The blocked-by links on this issue are removed. The backend change and the earlier Sample request issue are both closed.
- The earlier Sample request work sits on a branch that is not yet merged into the default branch and has no open pull request. Merge it before starting this work; this issue edits the same files.
- The Console's key-creation and integration documentation does not yet mention Sandbox. That copy is part of this work.
- A `sandbox` hostname constant already exists in the Console for AIHUB's internal Speaking demo gateway. It is the same hostname serving a different purpose for a different audience. The two must not be reused for one another.
- A Sandbox key occupies one of the active API key slots an Organization may hold, the same as any other key.
- The specification in this repository is `docs/superpowers/specs/2026-09-27-sandbox-key-sample-request-27.md`.

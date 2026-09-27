# Writing Task 1 Sample request

- Issue: [#32](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/32)
- Status: Ready for agent
- Related decisions: ADR-0003, ADR-0009
- Blocked by: [#31](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/31), which gives every Sample request its own identity
- Broader design: [Sample request and Writing Scoring catalog](https://github.com/AiHub-Ecosystem/AiHub-Frontend/blob/dev/docs/superpowers/specs/2026-09-27-sample-request-design.md)

## Problem Statement

An API key holding the Writing scope can grade two different things. The Console shows a Sample request for only one of them.

Writing Task 2 is an essay answering a question. Writing Task 1 is an essay describing a chart, and it needs four things the Task 2 request does not: the chart's type, and an image of the chart. The two are separate operations with separate endpoints, not one request with an option. A holder who wants to make a first call against Task 1 finds no Sample request for it and has to assemble the request from the API reference page — working out the endpoint, the headers, the field names, the chart type's exact spelling, and the image URL on their own.

Two things make Task 1 harder to get right than Task 2, and both fail quietly.

The chart type is a closed set of seven values distinguished by case. A lowercase value is rejected, and a subject word such as "environment" is rejected too, because the field is named for what it holds and the name is misleading: the field is called the chart type, but downstream the same value is called the topic. A holder who guesses wrong gets a validation failure with no field named.

The image URL is worse. Task 1 requires an image the customer holds, and AIHUB does not host one. A request carrying an image the grading service cannot fetch is not rejected — it is graded against nothing and returns a confident, wrong result. There is no error to notice, so a Sample request that shows a placeholder image without saying so would hand a holder a result they have no way to distrust.

## Solution

Show a Writing Task 1 Sample request beside the Task 2 one, for every key whose Writing scope permits it.

The tab a holder sees is renamed, so the two requests are told apart rather than both being called Writing. The Task 1 request documents the four fields it requires, names the seven chart types the API accepts, and says the names are case-sensitive. It carries a note stating that the image in the example is a placeholder which must be replaced with the holder's own chart, and that an unreachable image produces a wrong result rather than an error — the same warning the public API reference already gives, so the two surfaces do not contradict each other.

The request follows the key's Environment, exactly as the Task 2 request does.

The Task 1 request still will not run as copied, because the image has to be the holder's. That is stated rather than hidden, and it is the one thing that distinguishes this Sample request from every other the Console offers.

## User Stories

1. As an API-key holder, I want a Sample request for Writing Task 1, so that I can make a first call against it without assembling one from separate documentation.
2. As an API-key holder, I want the two Writing requests to be told apart by name, so that I know which tab is which.
3. As an API-key holder, I want the Task 1 tab listed before the Task 2 tab, so that the order matches how the two tasks are taught.
4. As an API-key holder, I want the Task 1 endpoint shown with its method, so that I know which operation the command calls.
5. As an API-key holder, I want the four fields Task 1 requires shown with sample values, so that I can see what the request must carry.
6. As an API-key holder, I want the field Task 1 does not accept left out of the example, so that copying it does not produce a request the API refuses.
7. As an API-key holder, I want the seven chart types the API accepts listed, so that I do not invent a value.
8. As an API-key holder, I want to be told the chart type's values are case-sensitive, so that I do not send a lowercase spelling and get a validation failure naming no field.
9. As an API-key holder, I want to be told the field holds a chart type and not a subject, so that I do not send a word like "environment".
10. As an API-key holder, I want the image in the example labelled a placeholder, so that I do not assume the example's image works.
11. As an API-key holder, I want to be told an unreachable image returns a wrong result rather than an error, so that I look for a wrong result instead of waiting for a failure that never comes.
12. As an API-key holder, I want the Task 1 command to be copyable in one action, so that I can run it from a Bash-compatible shell.
13. As an API-key holder, I want the headers table to show only the API-key prefix while the command carries the full key, so that the table is safe to inspect and the command is usable.
14. As an API-key holder, I want the same identity handling as the Task 2 request, so that a Declared User ID and a User Assertion behave the same in both.
15. As an API-key holder, I want the Task 1 request to carry an Idempotency-Key, so that rerunning it replays the stored result instead of grading again.
16. As an API-key holder, I want both Writing requests to share one Idempotency-Key, so that the dialog stays a single thing I read once.
17. As an API-key holder, I want to be able to tell the two tabs apart by which one is selected, so that I know which request I am looking at.
18. As a keyboard user, I want only one Writing tab to be the current tab, so that moving through the tabs moves one step at a time.
19. As a user of assistive technology, I want the two Writing tabs and their panels to have distinct element ids, so that no control is claimed twice.
20. As an API-key holder with a Sandbox key, I want a Task 1 request that targets the Sandbox host, so that my first call costs the Organization nothing.
21. As an API-key holder with a Sandbox key, I want the same allowance wording on the Task 1 request, so that I know what running it costs.
22. As an API-key holder, I want the expected successful response shown for Task 1, so that I can tell whether my request worked.
23. As an API-key holder, I want the common failures shown, so that I can diagnose a setup that did not work.
24. As a reader of the API reference, I want the Console to give the same warning about the placeholder image, so that the two surfaces do not contradict each other.
25. As a future maintainer, I want the Task 1 request built from the same example the API reference uses, so that the two cannot drift apart.
26. As a future maintainer, I want the Task 2 tab renamed as part of this change, so that the naming is corrected once rather than twice.
27. As a future maintainer, I want no extra idempotency-key state introduced, so that the dialog does not accumulate one key per request.

## Acceptance Criteria

- [ ] A key holding the Writing scope shows two Sample requests, Writing Task 1 and Writing Task 2, in that order, with any Speaking request after them.
- [ ] The existing Writing tab is renamed rather than left as a second unnamed Writing tab.
- [ ] The Task 1 request targets the Writing Task 1 grading endpoint with a JSON content type.
- [ ] Its body carries the four fields Task 1 requires — the question, the chart type, the essay, and the image URL — and carries none of the fields Task 1 rejects.
- [ ] The chart-type field lists the seven values the API accepts and states that the values are case-sensitive and name a chart type rather than a subject.
- [ ] The body table and the copyable command are built from the same single source of truth the API reference page uses, so the two cannot teach different contracts.
- [ ] A note states that the image URL in the example is a placeholder that must be replaced with a reachable image of the holder's own chart, and that a request carrying an unreachable image returns a wrong result rather than an error. The wording matches what the API reference page already says about that field.
- [ ] The note belongs to the Task 1 request alone and is not merged into the Task 2 note, which is about the idempotency key.
- [ ] The copyable command is Bash-compatible, carries the full API key through a shell variable, and quotes the identity placeholder so its angle brackets are not read as shell redirection. The headers table shows only the API-key prefix.
- [ ] The expected successful response shows the overall band, the criteria, and the summary, and names the first criterion as the Task 1 achievement criterion, which is not the Task 2 one.
- [ ] The Task 1 request carries the Idempotency-Key for the dialog's lifetime, the same value the Task 2 request carries, and the copy does not claim the two share an idempotency record.
- [ ] Identity handling is identical to the Task 2 request: a Declared User ID when the roster reports no active identity configuration, and a User Assertion placeholder otherwise.
- [ ] Exactly one Writing tab carries the selected state and the tab order position, the other does not, and the two tabs and their panels have distinct element ids.
- [ ] A Sandbox key shows two Writing requests that both target the Sandbox host, and both carry the Sandbox allowance wording.
- [ ] The optional language field is not in the example, matching the Task 2 request, because the Console would not be exercising a value a holder must send.
- [ ] No request runner is added, the raw key still travels only on the one-time reveal path, and nothing is written to storage, logs, analytics, or URLs.
- [ ] End-to-end coverage verifies the two tab names and their order, the Task 1 endpoint, the four body fields, the chart-type guidance, the placeholder note, and the idempotency key.
- [ ] End-to-end coverage verifies the selected state, the tab order position, and the distinct element ids across the two Writing tabs. This is the assertion that #31 could not make and deliberately deferred.
- [ ] End-to-end coverage verifies a Sandbox key targets the Sandbox host for both Writing requests.
- [ ] Unit coverage verifies the Task 1 builder, the set of requests a Writing key produces, and their order.
- [ ] Existing assertions that look for a tab named "Writing" are updated to the new names.

## Implementation Decisions

- **The example is already shared; this issue consumes it rather than creating it.** The single source of truth for the Task 1 example, and the body field type it requires, are #31's work. What remains here is a builder, a registry entry, and a name.

- **Both tabs share the dialog's one idempotency key.** The backend keys a stored result on the organization, the operation, and the key, and Task 1 and Task 2 are different operations, so the same key string is two different records. A key per tab would add state to the dialog and change nothing about what the API does. The copy is not to suggest the two requests share an idempotency record — that is precisely why sharing is safe.

- **The language field is left out.** Task 2 omits it, and adding it to Task 1 alone would be inconsistent while teaching a value no holder needs to send, since the grading service answers in Vietnamese regardless.

- **The Task 1 note stands alone.** The Task 2 note is about replaying a stored result. Merging an image warning into it would tell every Writing holder about a field their request does not have. The image warning is the single most consequential thing in this request, and it belongs where it cannot be read by someone whose request has no image.

- **The warning says the result is wrong rather than that the call fails, because that is what happens.** The grading service fetches the image itself and returns a graded response either way. Telling a holder to expect an error would send them looking for one that never arrives, which is the failure mode this issue most needs to prevent.

- **The wording matches the API reference's existing warning about that field.** The reference already tells a reader that the image is a placeholder and that a result will be wrong without one. Writing a second, differently-worded warning in the Console would leave a holder who read both unsure which to believe.

- **The tab is renamed in the same change that makes the name necessary.** Renaming alone is confusing; keeping "Writing" beside "Writing Task 1" is worse. Doing both at once means the names are never ambiguous, and the rename is not left as a follow-up that could be forgotten.

- **The order follows the two tasks.** Task 1 before Task 2 matches how the two are taught and how the backend orders them, and leaves Speaking last where it already is.

- **The Task 1 response differs from Task 2 in exactly one place.** Both return the same fields in the same order; the first criterion measures a different thing, because Task 1 is chart description and Task 2 is essay response. Saying so is more useful than a shared sentence that is true of neither alone.

- **The naming trap is not repeated in the UI.** The field is called the chart type in the public contract even though downstream calls the same value the topic, and the image field is called the image URL even though downstream calls it a URL. A Sample request teaches the public contract, so the public names are what appear, and the field's meaning is stated in words rather than by borrowing the downstream name.

- **No architecture decision record.** The change is a second entry in an existing registry, a name, and a note. It is easy to reverse, unsurprising once read, and not the result of a trade-off.

## Testing Decisions

- A good test verifies what a key holder sees or copies — the tab names and their order, the endpoint, the body, the chart-type guidance, the note, and the idempotency key. It does not assert private component state or styling structure.

- **Two existing seams. No new test seam, and no new test dependency.** The repository has no component-test setup, and this change does not need one: everything a holder sees is reachable through the reveal dialog on the API-key page.

- **End-to-end, through the Organization API-key page.** Its coverage already exercises create and rotate, the one-time reveal, the tab list, the selected tab, keyboard movement between tabs, the headers table, and the copyable command. Extending it covers the two Writing tabs, the Task 1 body, the note, and the Environment a Sandbox key targets. Prior art: the same suite already proves the staging-only case, where a key with no runnable request shows a note instead of a command.

- **The tab state assertions land here, not in #31.** #31 gave every Sample request its own identity and deferred the rendered proof, because no key could produce two requests for one scope and the repository has no seam that could assert it without adding a dependency. This issue creates the first such key, so the assertion belongs here: with both Writing tabs present, exactly one carries the selected state and the tab order position, and their element ids are distinct. This is the one acceptance criterion that was waiting for this issue.

- **Unit, at the Sample request builder.** The Task 1 request's shape, and the set and order of requests a Writing key produces, are decided there. Prior art: the builder tests already cover scope selection, identity readiness, host resolution by Environment, and the per-Environment usage note, so the Task 1 cases extend an existing shape.

- **The API reference page's existing coverage is reused, not duplicated.** It already pins the Task 1 example and the request field order. #31 moved that example into a single source of truth; this issue builds a request from it, so if the builder and the reference ever disagree the reference's own tests and the Console's tests fail together. No new test is written there.

## Out of Scope

- Any way to make the Task 1 request run as copied. That needs AIHUB to host a sample chart image, which is a separate piece of work with no issue yet.
- Speaking in the Sandbox Environment, which the backend does not support.
- Adding the optional language field to either Writing request.
- Giving each Writing request its own idempotency key.
- Changing the idempotency-key predicate, which answers a question about the key that must be settled before any Sample request is built.
- A request runner, or any other in-app execution of a Sample request.
- Any change to the public API reference, the create form, or the Environment handling.

## Further Notes

- The specification supersedes part of the original acceptance criteria. Those included a requirement that the body table and command come from the same single source of truth as the API reference example; that is #31's work, and this issue only consumes it. The original wording made that look handled here when it was not.
- The backend serves Task 1 and Task 2 through the same controller with the same request schemas, and the Sandbox Environment serves both with no narrowing. A Sandbox key therefore needs no separate Task 1 request, and the Environment resolution #27 introduced carries over unchanged.
- A Task 1 request is the only Sample request the Console offers that cannot succeed as copied. That is a property of the API, not a gap in this issue, and it is stated in the request rather than worked around.
- A key holding the Writing scope occupies one of the active API key slots an Organization may hold, the same as any other key; Task 1 adds no new key.

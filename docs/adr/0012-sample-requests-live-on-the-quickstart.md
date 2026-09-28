# Sample requests live on the Quickstart, not the reveal dialog

- Status: Accepted
- Date: 2026-09-28
- Issue: [#40](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/40), building on [#39](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/39)
- Refines: [ADR-0003](0003-one-time-api-key-reveal.md), the [Sample request design](../superpowers/specs/2026-09-27-sample-request-design.md)

The reveal dialog shown after creating or rotating an API key used to carry every Sample request for that key beside the raw key. It was cramped, the Sample requests vanished when it closed, and their commands inlined the raw key. Each usable key now has a Quickstart that lists its Sample requests for as long as the key is active, so the dialog hands over the raw key and nothing else: the key, its Copy button, the shown-once warning, and a link to the key's Quickstart.

That link opens the Quickstart in a new tab and leaves the dialog open. The alternatives were navigating in place, which throws the raw key away if the holder has not copied it yet, and gating the link on a copy, which needs copy-tracking state and strands a holder whose automatic copy failed and who copied by hand. A new tab cannot cost anyone their key and needs no state. The API keys page already clears a revealed key before any same-origin navigation; a link that opens a new tab is not a navigation of this page, so it is exempt.

A Sample request never contains the raw key. Its command reads `API_KEY` from the holder's environment and stops with a message when it is unset, so after this change the raw key appears only in the reveal dialog, which tightens ADR-0003 rather than relaxing it. The cost is one extra step for a holder who wants to run a sample immediately: export the key first.

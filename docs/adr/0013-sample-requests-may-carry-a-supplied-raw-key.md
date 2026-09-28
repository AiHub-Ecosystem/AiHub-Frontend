# A Sample request may carry a raw key the holder supplies

- Status: Accepted
- Date: 2026-09-28
- Refines: [ADR-0012](0012-sample-requests-live-on-the-quickstart.md), [ADR-0003](0003-one-time-api-key-reveal.md)

ADR-0012 kept the raw key out of every Sample request: each command read it from the holder's environment, so running one took two steps, exporting the key and then pasting the command. The product wants one step, copy and paste, and a command can only run as pasted if it carries the key. The backend stores a hash, not the raw key, so the Console can hold the raw key only where the holder already has it in the browser.

There are therefore exactly two ways a Sample request carries the raw key, and both keep it in the browser tab that already had it. The reveal dialog, which has just received the key, offers a copy button per Sample request whose command inlines it; the command is copied to the clipboard and never rendered. The Quickstart has a field where the holder may paste their raw key; while it holds a value that is this key's raw key (the backend's key format, starting with the key's display prefix), every command on the page inlines it. Neither sends the key anywhere, writes it to storage, or puts it in a URL, so ADR-0003's one-way reveal still holds for the Console itself. With no key supplied, commands read it from the environment exactly as before.

The cost is that the raw key now reaches the holder's clipboard and their shell, where it may stay in shell history. Both surfaces say so next to the command. The validation is also what makes inlining safe: a supplied value is accepted only in the key's own alphanumeric format, so it cannot carry a quote that would break out of the shell string it is placed in.

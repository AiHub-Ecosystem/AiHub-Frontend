# Show the validated demo key in request details and commands

- Status: Accepted
- Date: 2026-10-14
- Amends: [ADR-0018](0018-explicit-demo-environments-and-safe-exports.md)

## Decision

When a visitor has validated an API key for the current demo skill, the final Request panel shows that key in `X-API-Key`. Bash cURL, PowerShell, and Postman cURL copies use the validated key directly so the visitor can run or import the request without copying it into another field first.

The API key input remains masked. The key stays in page memory and is not written to storage, logs, or analytics. Key-validation request details remain redacted, as does the prompt intended for ChatGPT or another AI tool. Without a validated key, request examples use the existing placeholders.

The Request panel and command-copy note tell the visitor that the key is visible and must be kept private. Shell commands quote the key for the target shell.

This supersedes ADR-0018's rule that copied command artifacts never contain the supplied key. The key remains omitted from the agent prompt.

## Consequences

Visitors can copy a ready-to-run request after validating their key. The key is also visible on screen, in screenshots, in the clipboard, and in shell command history if a visitor runs the copied command. Visitors must keep those materials private. This does not change the API key's memory-only lifetime or backend validation and authorization.

## Acceptance checks

- A validated key appears in the final Request panel and the Bash, PowerShell, and Postman cURL commands.
- An absent or unvalidated key does not appear in request previews or copied commands.
- The agent prompt and API-key validation trace never contain the key.
- The UI warns visitors that copied commands contain their key.

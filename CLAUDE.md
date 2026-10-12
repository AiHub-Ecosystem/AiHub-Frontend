@AGENTS.md

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `AiHub-Ecosystem/AiHub-Frontend`; use the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default canonical triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.

### Working agreements

Three rule files at the repo root, none referenced from anywhere else. Read the
one that matches the work:

- `00AgentCollabRule.md` — assumptions, pushback, the reporting format. Read
  before planning a non-trivial change or handing work over.
- `01SystemArchitecturePrinciples.md` — feature lifecycle and the ADR trigger.
  Read when a change introduces an architectural decision.
- `02TechandCodeRule.md` — conventions and the Definition of Done. Read for any
  code change.

### Review

`CODING_STANDARDS.md` — reviewer rules. Read when reviewing a diff, not while
writing code.

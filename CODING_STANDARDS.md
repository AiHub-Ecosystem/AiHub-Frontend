# Coding standards — reviewer

Rules for reviewing a diff here. Conventions and the Definition of Done live in
`02TechandCodeRule.md`; this file holds only what no linter can decide.

## Verify the artifact, not the tool's self-report

A command exiting 0, a build reporting a package count, and a comment describing
what a flag does are all claims, not evidence. List the thing itself before
concluding: the directory, the response headers, the image contents.

In this repo that has gone wrong three times in one afternoon:

- `npm prune --omit=dev` exiting cleanly while leaving the whole dev tree behind,
  because the point of the command was to list what it removed, not to succeed
- a deploy assertion that passed on an image carrying twenty dev scopes
- a Dockerfile comment claiming `--os`/`--cpu` removed other platforms' binaries,
  when the image came out byte-identical without them

A check that reports success without showing what it inspected is not evidence.
If a step's output cannot answer "what was actually there", it is not a check.

## Checks enumerate the truth, not the mistakes

A denylist catches only what somebody remembered to list. When a check guards
something real, derive the expected value from the source of truth and compare.

`scripts/prod-dependencies.mjs` is the pattern: `package-lock.json` says which
packages are production, the image is compared against that list, and a
difference prints a diff. Adding a dev dependency then fails the build by itself,
with no edit to the check.

When reviewing a new assertion, ask what it would do about a case nobody wrote
down. If the answer is "pass", it is a denylist.

## Prefer the boring mechanism

Two failures here came from a tool that reported success and a comment written
from memory. Both were caught only by running the thing twice and comparing the
numbers. Reproduce outside the expensive path first: an `npm ci` in a scratch
directory settles a dependency question in ten seconds, where a container build
takes two minutes and leaves a gigabyte behind.

## Scoping a change

A change that turns out to rest on a wrong premise gets corrected in place, and
the correction says what was wrong. Do not leave a reverted commit claiming a
benefit that was measured to be zero.

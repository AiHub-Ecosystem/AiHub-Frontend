# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                                                                                                                              |
| -------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue                                                                                                              |
| `needs-info`               | `question`           | Waiting on reporter for more information                                                                                                             |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent                                                                                                              |
| `ready-for-human`          | —                    | No equivalent label. This repo has no "requires human implementation" label; do not reach for `help wanted`, which means "extra attention is needed" |
| `wontfix`                  | `wontfix`            | Will not be actioned                                                                                                                                 |

When a skill mentions a role (e.g. apply the AFK-ready triage label), use the corresponding label string from this table. `gh` rejects a command whose label does not exist, so check `gh label list` if a mapping here looks wrong.

Edit the right-hand column to match whatever vocabulary you actually use.

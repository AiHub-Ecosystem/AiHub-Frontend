# AiHub Frontend

The customer-facing web console and its public documentation site, plus the
end-to-end suite that guards both.

## Language

**Shard**:
One of three equal parts the browser test suite is divided into so the parts run
at the same time instead of one after another. A shard is a whole test file or
several, never a fraction of one test.
_Avoid_: Split, partition, worker, job

**Port offset**:
The per-shard shift applied to every port the end-to-end suite binds, so shards
running side by side each get their own. No offset outside CI.
_Avoid_: Base port, port range, dynamic ports

**Shard index**:
The shard's position in the run, starting at 1. It shifts the Port offset, names
the shard's Redis container, and labels its log output.
_Avoid_: Shard id, shard number, job index

# RULE 01 — SYSTEM ARCHITECTURE & PROCESS

> Core principle: **Architect products, not projects** — design evolvable products rather than point solutions for specific projects. Avoid "Big Upfront Design"; adopt an iterative architectural approach. Build small, scalable components that aggregate into a larger system.

---

## A. Mandatory Feature Lifecycle

Every feature must pass through the following stages; **no skipping allowed**. Each stage requires specific **output artifacts** and a **control gate** to proceed to the next—no artifact means the gate has not been passed.

| # | Stage | Output Artifact(s) | Gate to Proceed |
|---|---|---|---|
| 1 | Idea & Problem | Problem description + business value + priority | Stakeholder confirms it is worth doing |
| 2 | Specification (Spec) | User stories, acceptance criteria, non-functional requirements, out-of-scope items | Measurable acceptance criteria |
| 3 | Design | Contract design (API/schema), data flow diagrams, ADRs (for major decisions) | Contract reviewed |
| 4 | Planning | List of granular steps, sequence, affected files/modules, risks | Each step independently shippable |
| 5 | Implementation | Code + tests + docs bundled in each PR | Definition of Done (Rule 02) |
| 6 | Review | PR review, feedback addressed | Approval |
| 7 | Release | CI/CD deployment, behind feature flags / gradual rollout | Rollback mechanism in place |
| 8 | Observation | Post-release metrics, logs, error rates, alerts | No regressions |
| 9 | Cleanup | Remove flags, delete dead code, update docs, review (keep/modify/remove) | No leftover clutter | **Supplementary Rules:**

- Do not merge phases 1–4 (thinking/planning) and 5–9 (execution). Modifying specifications during phase 2 is orders of magnitude cheaper than fixing code during phase 6.
- For minor features, phases 2–4 may be consolidated into a single brief document, but **no "gate" may be skipped**—"minor" does not mean "no specifications, no testing, or no review."
- Phases 8–9 are mandatory: a feature is **not complete** until it has been monitored post-release and its feature flag removed. Features that show no usage after measurement must be slated for removal—dead code constitutes technical debt.

---

## B. Principles of a Stable System

1. **Contract-first / API-first.** APIs (REST, GraphQL, events) must be designed and reviewed before implementation begins; capabilities are exposed via contracts (OpenAPI, schemas) prior to UI development. Once a contract is public, changes must be backward-compatible (additive only); breaking changes require versioning (e.g., `/v1`, `/v2`) and a formal deprecation roadmap. *For API marketplace products: the API is the product, and the contract represents the commitment to the customer.*
2. **Clear boundaries.** The system is organized into modules or domains with explicit boundaries; modules communicate solely through public interfaces and must not directly access another module's internal data tables or functions.
3. **Single source of truth.** Each data type has exactly one owner. Any copies (caches, denormalized views) require a synchronization mechanism and must be treated as potentially stale or inconsistent.
4. **Design for failure (fail gracefully).** Any external call (network, database, third-party API, LLM provider) is prone to failure; therefore, timeouts, limited retries with backoff, and controlled graceful degradation are mandatory. There is no room for "hope-based" calls. 5. **Idempotency.** Network-based write operations subject to retries (e.g., payments, order creation, webhooks) must be idempotent or utilize idempotency keys. Distributed systems will inevitably send duplicate messages.
6. **Observability from Day One.** Structured logs, metrics (latency, error rates, throughput), health checks, correlation/trace IDs, and threshold-based alerts are core features, not afterthoughts. Do not debug production environments by guessing.
7. **Decouple configuration from code.** Avoid hard-coding environment-specific settings; differences between dev, staging, and production should be handled via configuration, while secrets reside in a secret manager.
8. **Specific to AI/LLM products:**
- Treat model output as **untrusted input**—validate it before use. 
- Implement guardrails to prevent prompt injection. 
- Log sufficient input/output data for debugging and evaluation. 
- Measure model quality using a fixed **eval set**, not subjective intuition. 
- Always have a contingency plan for provider outages or price changes (e.g., fallback providers, abstraction layers).

---

## C. Build small, scale big

9. **Start with the simplest thing that works correctly** — usually a **modular monolith** with clean module boundaries. Do not build microservices, message queues, or multi-region setups until there is evidence of actual demand (real traffic, real organizational needs).
10. **Split services based on evidence, not trends.** Conditions for splitting include: distinct scaling requirements, conflicting release cycles, or team boundaries. Since module boundaries are already clean (Rule B.2), splitting later is inexpensive—which is precisely why Rule B.2 exists.
11. **Default to statelessness.** Services do not maintain state within the process; state is offloaded to the storage layer (DB/cache/queue). This is a prerequisite for horizontal scaling by adding instances.
12. **The data model is the foundation.** Changing a schema is far more costly than changing code—data design requires the most rigorous review. Every migration must be safely forward-compatible and include a rollback plan. Code can be fixed in a day; a flawed data migration can incur costs for years.
13. **Each component does one thing and does it well** (system-level single responsibility). A component must not handle both business logic and infrastructure management.
14. **Every major architectural decision requires an ADR** (Architecture Decision Record): context → considered options → decision → accepted trade-offs. ADRs are append-only; to change a decision, write a new ADR rather than altering history.
15. **Prioritize replaceability.** Design components so they can be replaced or removed without bringing down the rest of the system. The stability of a large system stems from the ability to swap out individual small parts.
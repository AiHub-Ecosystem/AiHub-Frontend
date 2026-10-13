# AIHUB Customer Web

The public AIHUB site and the signed-in Console where people manage their AIHUB User Account, Organizations, members, and API keys. Domain terms follow the backend glossary in `aihub-be/CONTEXT.md`; this file lists the ones this app uses and the few it adds.

## Language

### The app

**Customer Web**:
This application: the marketing site, API documentation, demos, and the Console, served from one origin.
_Avoid_: portal, frontend, sandbox demo

**Console**:
The signed-in area of the Customer Web where a User Account manages its Organizations.
_Avoid_: dashboard, admin panel, workspace

**API product**:
A sellable AIHUB capability listed in the public catalog, such as Writing Scoring, exposing one or more endpoints.
_Avoid_: service, feature

**API reference**:
The public documentation page for one endpoint of an API product.
_Avoid_: specs, spec page

**BFF**:
The Customer Web's own server routes and the only part of the app that talks to AIHUB. It exchanges the browser's opaque Web Session cookie for a short-lived User Access JWT and holds API keys; a newly issued raw API key passes to the browser once for immediate display.
_Avoid_: proxy, gateway

**Web Session**:
An AIHUB-owned sign-in session for one browser, identified by an opaque HttpOnly cookie and exchanged server-to-server for a short-lived User Access JWT cached in process memory until shortly before expiry.
_Avoid_: login, token, auth cookie

### Accounts and Organizations

**User Account**:
The AIHUB account a person registers with email, username, and password, and verifies by email before signing in.
_Avoid_: user, customer, profile

**Username**:
A normalized, unique account identifier, separate from the credential used to sign in.

**Email Verification**:
Proof that a User Account controls its registered email address; an unverified User Account cannot sign in.

**Verification Token**:
An expiring proof used for Email Verification. Resending while an account is pending invalidates earlier tokens; the exact token that activated an active account continues to succeed until it expires.

**Signup Browser Binding**:
A temporary association between a Verification Token and the browser that requested registration or a resend. It permits Verification Sign-in at most once in that browser.

**Verification Sign-in**:
The one-time sign-in granted after Email Verification when the request comes from the browser associated with the Verification Token.

**Password Recovery**:
A request to email password-reset instructions without revealing whether an address belongs to a User Account.
_Avoid_: forgot-password request

**Password Reset Token**:
An expiring, one-time credential emailed for Password Recovery. A newer request replaces it, and a successful reset consumes it and revokes every existing AIHUB Web Session.
_Avoid_: Verification Token, recovery link

**Organization**:
The tenant that owns API keys, members, and identity configuration; one User Account may belong to several.
_Avoid_: team, workspace, tenant, company

**Organization Roster**:
The Organizations where a User Account has an active membership, including suspended Organizations, with each Membership Role and Organization status.

**Self-serve Organization**:
An Organization a User Account created in the Console, starting on limited default terms that only AIHUB operators can raise.
_Avoid_: trial org, free org

**Organization Creation Limit**:
A User Account may create at most three Self-serve Organizations over its lifetime, regardless of its current Organization memberships.

**Membership Role**:
A User Account's authority inside one Organization: `owner`, `admin`, or `member`.
_Avoid_: permission, access level

**Organization Invitation**:
A pending offer, sent by email, for one address to join an Organization; it becomes a membership only when accepted.
_Avoid_: invite link, join request

### Integration

**API key**:
The Organization's secret credential for calling AIHUB grading APIs from the Organization's own backend; its raw value is shown once after creation or rotation and cannot be retrieved again.
_Avoid_: token, secret, access key

**API key scope**:
One capability an API key permits, named as a dotted string such as `writing.grade` or `speaking.grade`; a key holds zero or more, and may call only the endpoints its scopes permit.
_Avoid_: permission, entitlement, feature

**Environment**:
The request tier AIHUB derives from the hostname a request is sent to; an API key only works in the Environments it allows. A customer may allow `production`, `staging`, or `sandbox`. The Sandbox Environment is AIHUB's capped test tier: calls do not count against the Organization's paid usage, and a Sandbox key cannot call Production. Customer Sandbox keys may carry `writing.grade`, `speaking.grade`, or both; public demos require the scope for the selected skill ([ADR-0017](docs/adr/0017-sandbox-backed-scoring-demo.md)). The public demos and the signed-in Console both offer an explicit Sandbox/Production choice defaulting to Sandbox, and the Console binds each new key to the one environment it was created for ([ADR-0018](docs/adr/0018-explicit-demo-environments-and-safe-exports.md)).
_Avoid_: mode, live/test

**Customer Sandbox API key**:
An Organization-owned key restricted to the Sandbox Environment and issued separately from its Production key. Customer key creation permits only `writing.grade`, `speaking.grade`, or both; the public demo checks the selected skill's scope ([ADR-0017](docs/adr/0017-sandbox-backed-scoring-demo.md)). A key created in the Console carries the display prefix `aihub_sandbox_`.

**Customer Production API key**:
An Organization-owned key restricted to Production, carrying the display prefix `aihub_prod_`. Its calls may incur charges under the Organization's Production policy, so a demo visitor must acknowledge billable use before the first Production grade of a visit ([ADR-0018](docs/adr/0018-explicit-demo-environments-and-safe-exports.md)).

**Sandbox API key**:
The server-held key of AIHUB's dedicated demo Organization, separate from every Customer Sandbox API key.

**Sample request**:
A request shown for an active API key so its holder can make a call with it, one for each operation the key's API key scopes permit that has a known endpoint. An API key scope may permit more than one operation, so an Organization's key may be offered several Sample requests. A Sample request carries the raw key only when its holder supplies it in the browser, by copying it from the reveal or pasting it on the Quickstart; otherwise its command reads the key from the holder's environment. It may also depend on things only its holder has, such as their own chart image or the question they answer; where AIHUB publishes a sample input, such as a chart image or a Published sample answer, the Sample request uses it so it runs as copied.
_Avoid_: playground, test call, try-it

**Speaking question**:
One question in the Speaking catalog AIHUB publishes, identified by its `question_id` and carrying its prompt text. Its catalog audio is a sample recording of an answer to that question, signed for a short time only; it is candidate audio, not the examiner reading the prompt. A Speaking grading request names the question the answer responds to.
_Avoid_: examiner narration, prompt audio as answer, question file

**Published sample answer**:
A stable, unsigned public copy of one answer recording from the Speaking catalog, published so a copied Sample request can send it for grading. Unlike the catalog's own answer audio it does not expire. It answers exactly one Speaking question and exists for no other.
_Avoid_: sample audio, demo file, catalog audio

**Quickstart**:
The Console page belonging to one active, unexpired API key that lists that key's Sample requests. It stays reachable for as long as the key does; a revoked, expired, or rotated-away key has no Quickstart, and neither does a key with no Sample request.
_Avoid_: try page, playground, getting started

**Identity configuration**:
An Organization's issuer plus JWKS URL or public JWKS, which AIHUB uses to verify the User Assertions the Organization signs.
_Avoid_: JWKS settings, SSO config

**User-scoped request**:
A request that names one end user of an Organization, so AIHUB meters and reports it under that user. A user-scoped request carries `X-User-Identity`; an API product may also expose endpoints that are not user-scoped, such as reading a public question catalog, which carry no such header.
_Avoid_: authenticated request, per-user call

**User Identity**:
The value an Organization sends in `X-User-Identity` to name the end user of a user-scoped request. It is either a Signed User Assertion or a Declared User ID, and which one applies is decided by whether the Organization has an active Identity configuration, never by the shape of the value.
_Avoid_: end-user ID, user ID, user token

**User Assertion**:
A short-lived signed statement from an Organization-controlled identity provider that identifies an end user to AIHUB in `X-User-Identity` for a user-scoped request. The signed form of a User Identity, used by an Organization that has an active Identity configuration.
_Avoid_: AIHUB token, API key

**End-User ID**:
The identifier naming one end user of an Organization, in either transport: 1–256 visible ASCII characters (0x21–0x7E) with no whitespace. An email address is a valid value and is stored and forwarded as-is. AIHUB meters usage and reports Speaking `user_id` under it.
_Avoid_: user ID, user, student ID

**Declared User ID**:
An End-User ID sent unsigned in `X-User-Identity` by an Organization that has no active Identity configuration. AIHUB accepts it as declared, so any holder of the Organization's API key can name any end user within that Organization.
_Avoid_: unsigned assertion, user ID, user-scoped ID

**Identity Readiness**:
Whether an Organization has a saved active Identity configuration. This reports configuration state, not current JWKS source reachability.
_Avoid_: configured (when it could include a disabled configuration)

## Accepted demo extension — implementation pending

The existing runtime remains Sandbox-only for live demos and Production-only for Console key creation. [ADR-0018](docs/adr/0018-explicit-demo-environments-and-safe-exports.md) records the accepted extension: explicit Sandbox/Production selection, pinned environment hosts, an explicit Production-cost acknowledgement, safe request exports, and the Sandbox allowance policy. The paired backend design is ADR-0095 in the `aihub-be` worktree.

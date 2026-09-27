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
The Customer Web's own server routes and the only part of the app that talks to AIHUB. It holds the Web Session credentials and API keys; a newly issued raw API key passes to the browser once for immediate display.
_Avoid_: proxy, gateway

**Web Session**:
The signed-in state of one browser, identified by an opaque cookie and backed by server-side storage of the User Access JWT and Refresh Token.
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
An expiring, one-time credential emailed for Password Recovery. A newer request replaces it, and a successful reset consumes it and revokes every existing AIHUB Refresh Token.
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
The request tier AIHUB derives from the hostname a request is sent to; an API key only works in the Environments it allows. A customer may allow `production`, `staging`, or `sandbox`. The Sandbox Environment is AIHUB's free test tier: its calls do not count against the Organization's paid usage, and a Sandbox key allows that Environment alone and carries only the `writing.grade` scope.
_Avoid_: mode, live/test

**Sample request**:
A request shown beside a newly issued API key so its holder can make a first call, one for each API key scope that has a known endpoint; it exists only while that raw key is on screen. A Sample request may depend on several things only its holder has, such as an audio file or the question being answered.
_Avoid_: playground, test call, try-it

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

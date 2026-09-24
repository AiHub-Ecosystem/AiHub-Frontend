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

**BFF**:
The Customer Web's own server routes; the only part of the app that talks to AIHUB, holding every token and API key so the browser never sees one.
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

**Organization**:
The tenant that owns API keys, members, and identity configuration; one User Account may belong to several.
_Avoid_: team, workspace, tenant, company

**Self-serve Organization**:
An Organization a User Account created in the Console, starting on limited default terms that only AIHUB operators can raise.
_Avoid_: trial org, free org

**Membership Role**:
A User Account's authority inside one Organization: `owner`, `admin`, or `member`.
_Avoid_: permission, access level

**Organization Invitation**:
A pending offer, sent by email, for one address to join an Organization; it becomes a membership only when accepted.
_Avoid_: invite link, join request

### Integration

**API key**:
The Organization's secret credential for calling AIHUB grading APIs from the Organization's own backend; shown once at creation.
_Avoid_: token, secret, access key

**Identity configuration**:
An Organization's issuer plus JWKS URL or public JWKS, which AIHUB uses to verify the User Assertions the Organization signs.
_Avoid_: JWKS settings, SSO config

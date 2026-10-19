# AIHUB Customer Web

Terms for the public AIHUB site and signed-in Console, where User Accounts manage Organizations.

## Language

### API integration

**AIHUB API contract**:
The OpenAPI description pinned by Customer Web to a specific AIHUB commit. It defines the response status and body, plus request limits the web application relies on.

### Sign-in

**Web Session**:
A Customer Web sign-in session for one browser; a User Account may have separate Web Sessions on other devices.
_Avoid_: Refresh Session

**Signup Browser Binding**:
Evidence that a verification link is opened in the browser that started registration; it permits sign-in immediately after verification.
_Avoid_: signup session

### Accounts and Organizations

**User Account**:
The credential-bearing account AIHUB manages for user-facing access. It is distinct from an Organization.

**Username**:
The normalized, unique identifier owned by a User Account.

**Organization creation attempt**:
One User Account's intent to create a Self-serve Organization using a specific request. Repeating the same request is a retry of that attempt; changing the request starts a new attempt.
_Avoid_: creation session

### Account appearance

**Avatar**:
An optional customer-supplied image that identifies one User Account. A User Account has at most one.

**Username initial fallback**:
The uppercase first visible Unicode grapheme of a Username, shown when its Avatar is absent or cannot be loaded.

### Scoring demos

**Customer Sandbox API key**:
An Organization-owned API key authorized for the Sandbox Environment, distinct from AIHUB's own server-held demo key. It may carry `writing.grade`, `speaking.grade`, or both.

**Customer Production API key**:
An Organization-owned API key authorized for Production; requests may incur charges under the Organization's Production policy.

**Demo environment**:
The explicitly selected Sandbox or Production request tier for a demo visit. The selected tier must match the key's backend-authorized environment.

**Demo visit**:
One temporary visit shared by the Writing and Speaking demos, with one demo identity and optionally one customer API key authorized for its selected environment.

**Demo identity**:
The end-user identity value used for one demo visit's Live calls: a random UUID in `declared_id` mode or a customer-issued Signed User Assertion in `signed_assertion` mode. Writing and Speaking share the value for the visit; it is separate from the participant's AIHUB User Account identity.
_Avoid_: AIHUB username

**Declared User ID**:
A stable identifier from a customer application sent as `X-User-Identity` when the Organization uses declared identity mode; it is not an email address, name, or phone number.

**Signed User Assertion**:
A short-lived JWT issued by an Organization's own backend for an end user and sent as `X-User-Identity` when the Organization uses signed assertion mode.

**Demo Assertion Endpoint**:
An endpoint operated by an Organization that issues short-lived Signed User Assertions for its fixed demo test user.
_Avoid_: token mint endpoint

**Demo test user**:
An Organization's dedicated non-production end user selected by its Demo Assertion Endpoint.

**Production confirmation**:
The visitor's explicit acknowledgement before the first Production grade in a demo visit that it may incur real charges. It is cleared when the key or selected environment changes.

**Sandbox dispatch allowance**:
The maximum number of Sandbox grading dispatches admitted for an Organization in one UTC calendar month, subject to the shared Sandbox ceiling.

**Sandbox allowance override**:
A month-specific total Sandbox dispatch allowance for one Organization that replaces the default for that UTC month; it is not an additive bonus.

**Mock result**:
A fixed example grading response that shows the report format without claiming to evaluate the visitor's answer.

**Live grading**:
A Writing or Speaking grading attempt against the visitor-selected Environment using a customer API key authorized for that Environment and the matching scope.

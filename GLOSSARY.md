# AIHUB Customer Web

Terms for the public AIHUB site and signed-in Console, where User Accounts manage Organizations.

## Language

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

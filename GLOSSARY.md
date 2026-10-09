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

**Organization creation attempt**:
One User Account's intent to create a Self-serve Organization using a specific request. Repeating the same request is a retry of that attempt; changing the request starts a new attempt.
_Avoid_: creation session

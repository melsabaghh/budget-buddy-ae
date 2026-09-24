# Reliable budget saving

## Goal
Make transactions, “match planned,” savings, and categories persist to the signed-in account and remain consistent across mobile and web.

## Changes
- Replace the lossy save timer with a queued save process so edits made during another save are never skipped.
- Prevent the initial account download from overwriting changes entered while loading.
- Save related records in a safe order, avoiding category/transaction conflicts.
- Keep the existing per-account device copy as an immediate fallback when connectivity is interrupted.
- Verify category, transaction, match, and savings changes survive refresh and exist in the account database.

## Technical details
- Track local revisions and pending cloud writes in `budget-store`.
- Serialize cloud writes and re-run when a newer local revision exists.
- Make full-replacement deletion respect transaction-to-category relationships.
- Test through a signed-in browser session and check the stored record counts.

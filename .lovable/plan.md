Cloud is now enabled. Here's how I'll ship real accounts + move your budget data per user. This is a large change, so I'll do it in two phases so you can review after phase 1.

## Phase 1 — Accounts & gated app (this turn)

**Auth page `/auth`**
- Tabs: Sign in / Sign up.
- Email + password with Zod validation and friendly errors.
- Continue with Google (Lovable managed).
- Continue with Apple (Lovable managed).
- Same calm-finance styling as the rest of the app.
- Auto-redirects signed-in users to `/`.

**Route gating**
- Move all app routes (`/`, `/transactions`, `/categories`, `/debts`, `/savings`) under a pathless `_authenticated/` layout so they require sign-in.
- `/auth` stays public. Unauthenticated visits to any protected route redirect to `/auth`.

**Header/user menu**
- Add avatar + display name + Sign out in `AppShell`.
- Session listener in `__root.tsx` invalidates router on sign-in/out.

**Database**
- `profiles` (id → auth.users, display_name, avatar_url, created_at) with RLS "own row only" + trigger `handle_new_user` to auto-create on signup.
- `user_roles` + `has_role()` scaffold (unused now, ready for admin later).

**Data**
- Budget data stays local for phase 1 but is namespaced per user id so switching accounts doesn't leak data.
- Header shows a "Sync to cloud" hint that will light up after phase 2.

## Phase 2 — Move budget data to cloud (next turn, on your OK)

- Tables: `categories`, `transactions`, `debts` fields, `savings_goals` with `user_id`, RLS `auth.uid() = user_id`, GRANTs to authenticated.
- Server functions via `createServerFn` + `requireSupabaseAuth` for reads/writes.
- Replace the `useCategories/useTransactions/useSavings` local hooks with React Query hooks backed by those server fns; every existing page keeps the same API surface.
- One-time "Import from this device" button that pushes existing localStorage data into the account.

## Technical notes

- Google + Apple wired via `lovable.auth.signInWithOAuth("google"|"apple", { redirect_uri: window.location.origin })`. Configured through `supabase--configure_social_auth`.
- Auth attacher middleware already registered in `src/start.ts`.
- Password reset (`/reset-password`) not included unless you want it — say so and I'll add it in phase 1.
- No profile fields to edit yet (display name pulls from OAuth or email local-part); a profile settings page can come in phase 2.

Approve to proceed with phase 1.
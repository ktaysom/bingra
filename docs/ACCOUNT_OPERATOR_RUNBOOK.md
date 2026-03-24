# Account System Operator Runbook

## Canonical model (quick summary)
- `accounts` = canonical Bingra identity.
- `account_auth_links` = linked login credentials (`auth_user_id`) for an account.
- `players.profile_id` currently stores canonical account identity for new authenticated writes.
- Career tables (`profile_game_results`, `profile_stats`) are keyed by the same canonical id.

## Sign-in method model
- Email/phone are private auth credentials, not public profile identity.
- Public identity remains `username`.
- Add flow:
  1. `/me` prepare action validates conflicts.
  2. short-lived link-intent cookie is set.
  3. OTP/magic-link verification completes.
  4. callback/finalize links verified `auth_user_id` into `account_auth_links`.
- Remove flow:
  - unlinks `account_auth_links` row only.
  - does **not** delete underlying `auth.users` credential.
  - blocked if it would remove last linked method.

## Merge operations
- Merge direction: `source_account_id -> target_account_id`.
- Always run dry-run first.

### Dry-run
```bash
npm run merge:accounts -- --source <source_account_id> --target <target_account_id> --dry-run
```

### Apply
```bash
npm run merge:accounts -- --source <source_account_id> --target <target_account_id> --apply --merged-by <auth_user_id>
```

## Career rebuild guidance
- Apply merges clear source aggregates and invalidate target aggregate row.
- Rebuild is normally triggered by merge tooling automatically.
- Manual fallback:
```bash
npm run repair:profile-links-and-career-stats
```

## Inspection / diagnostics
Inspect one account:
```bash
npm run inspect:account -- --account <account_id>
```

Output includes:
- account row (`is_active`, `merged_into_account_id`)
- linked auth methods
- player count
- recent result count (30d)
- presence of profile_stats row

## Production caution notes
- Run merge dry-run and review duplicate-player overlap before apply.
- Perform DB backup/snapshot before merge apply in production.
- Merge operations are transaction-scoped, but post-merge validation is still required.
- Keep one login method linked at all times for active accounts.

## Rollback guidance
- If merge apply fails mid-transaction, Postgres rollback should revert writes automatically.
- If merge apply succeeds but business correction is needed, use:
  - `account_merges` audit entry,
  - account inspection output,
  - DB backup,
  - controlled compensating admin operation.

## Known limitations (current phase)
- Removing sign-in method does not delete underlying auth credential.
- No self-serve merge UX (admin/script only).
- Credential conflict scan currently uses admin user listing; adequate for current scale, may need optimization later.

# Account System Manual Validation Checklist

## Preconditions
- Migrations are applied.
- Service-role env vars are present for admin scripts.

---

## A) Sign-in method flows

### 1. Add email method
- [ ] Sign in with existing account (phone or email).
- [ ] In `/me`, add a new email.
- [ ] Verify magic link.
- [ ] Confirm `/me` shows both methods linked.

### 2. Add phone method
- [ ] Sign in with existing account.
- [ ] In `/me`, add a new phone.
- [ ] Verify SMS code.
- [ ] Confirm `/me` shows both methods linked.

### 3. Duplicate conflict
- [ ] Try adding email already linked to another account.
- [ ] Confirm clear conflict error.
- [ ] Try adding phone already linked to another account.
- [ ] Confirm clear conflict error.

### 4. Same-account duplicate
- [ ] Try adding email already linked to current account.
- [ ] Confirm clear “already linked to this account” message.
- [ ] Try adding phone already linked to current account.
- [ ] Confirm clear “already linked to this account” message.

### 5. Removal safety
- [ ] With two linked methods, remove one.
- [ ] Confirm success and remaining method works.
- [ ] Attempt removing last remaining method.
- [ ] Confirm blocked with clear message.

---

## B) Merge operations

### 6. Merge dry-run
- [ ] Run:
  - `npm run merge:accounts -- --source <source> --target <target> --dry-run`
- [ ] Confirm output includes duplicate counts + planned impacts.

### 7. Merge apply
- [ ] Run:
  - `npm run merge:accounts -- --source <source> --target <target> --apply --merged-by <auth_user_id>`
- [ ] Confirm success response contains `merge_id`.

### 8. Post-merge login verification
- [ ] Verify both original credentials authenticate to same target account context.
- [ ] Confirm source account is tombstoned (`is_active=false`, `merged_into_account_id=target`).

### 9. Post-merge `/me` verification
- [ ] Confirm `/me` loads normally.
- [ ] Confirm sign-in methods list is coherent.
- [ ] Confirm career snapshot/recent games are present after rebuild.

---

## C) Diagnostics helpers

### 10. Inspect account script
- [ ] Run:
  - `npm run inspect:account -- --account <account_id>`
- [ ] Confirm account row, linked methods, player count, result count, stats presence are reported.

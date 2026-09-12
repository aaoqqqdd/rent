# Dangling foreign keys in the D1 schema

## What happened

SQLite rewrites `REFERENCES` clauses in *other* tables when you
`ALTER TABLE x RENAME TO y` (with the default `legacy_alter_table = OFF`).
Several historical migrations renamed a table, let SQLite repoint every child
FK at the temporary name, and then the temporary table was either dropped or
kept only as a stub/mirror:

| Migration | Rename | Temp table fate |
|-----------|--------|-----------------|
| `0018_migrate_users_to_snake_case` | `users` → `users_old` | kept, backfilled **once** by `0069` (no sync trigger) |
| `0044_add_retired_device_status` | `devices` → `devices_before_retired_status` | kept as an `id`-only stub, **trigger-synced** to `devices` by `0060` |
| `0074_add_windows_account_commands` | `device_commands` → `device_commands_legacy` | dropped |

The result: many tables have `FOREIGN KEY ... REFERENCES "<temp name>"(...)`
clauses whose parent is gone or is not the real table.

## Why it matters

D1 does **not** enforce foreign keys in production (`PRAGMA foreign_keys`
defaults off), so live traffic is unaffected. But
`wrangler d1 execute --local` and `wrangler dev` on current wrangler
(4.118+) run with `PRAGMA foreign_keys = 1`, so a plain `INSERT` into an
affected table fails with `FOREIGN KEY constraint failed` (verified locally
against `orders`). That blocks local testing and seeding.

## Full inventory (as of migration 0102)

Query used:

```sql
SELECT name, sql FROM sqlite_master
WHERE type='table'
  AND (sql LIKE '%users_old%'
    OR sql LIKE '%devices_before_retired_status%'
    OR sql LIKE '%device_commands_legacy%');
```

| Table | Dangling clause(s) | Also referenced by |
|-------|--------------------|--------------------|
| `orders` | `userId`→`users_old`, `referrerId`→`users_old`, `deviceId`→`devices_before_retired_status` | 8 tables (see below) |
| `contracts` | `created_by`→`users_old` | `sign_sessions` |
| `payments` | `customer_id`→`users_old` | `payment_proofs`, `payment_refunds` |
| `payment_proofs` | `verified_by`→`users_old` | — |
| `commission_records` | `referrer_id`→`users_old`, `customer_id`→`users_old` | — |
| `commission_withdrawals` | `user_id`→`users_old`, `processed_by`→`users_old` | — |
| `addresses` | `user_id`→`users_old` (ON DELETE CASCADE) | — |
| `device_entries` | `device_id`→`devices_before_retired_status`, `created_by`→`users_old` | — |
| `device_maintenance` | `device_id`→`devices_before_retired_status` | — |
| `error_logs` | `user_id`→`users_old` (ON DELETE SET NULL) | — |
| `device_command_results` | `command_id`→`device_commands_legacy` | — |

> **Update:** `commission_records` was itself `DROP TABLE`d by
> `0108_unify_referral_reward_ledger.sql` (folded into `referral_rewards`)
> before the fix migration below was ever applied, so it's no longer part of
> the rebuild — see "What migration 0121 does".

## Fix policy

* `→ "users_old"` — **drop the clause.** `users_old` is backfilled only once
  (`0069`) and never trigger-synced, so any account created after `0069` is
  absent from it. Re-pointing at `users(id)` would add an enforced constraint
  that legitimately new rows can violate. Keep the column, drop the FK.
* `→ "devices_before_retired_status"` — **re-point at `devices(id)`.** The
  stub is kept in exact sync with `devices` by `sync_device_legacy_parent_*`
  (`0060`), so the constraint is satisfiable, and `devices` is the real parent.
* `→ "device_commands_legacy"` — **re-point at `device_commands(id)`**, the
  table that replaced it in `0074`.
* Clauses already pointing at live tables (`orders`, `payments`, `devices`)
  are kept unchanged.

## What migration 0129 does, and the deeper bug found while applying it

`0129_drop_dangling_foreign_keys.sql` (numbered `0103`, then `0121`, in
earlier drafts) rebuilds the 9 originally-planned tables — `commission_records`
dropped out from under it, see above — plus, after two failed production
apply attempts, several more tables that turned out to need the same
treatment. The original plan was: rebuild `orders` separately (in what was
then `0120_expand_order_status_check.sql`) and leave the other 9 tables'
`REFERENCES orders(id)` clauses alone, since "`0121` never renames `orders`
itself, so those clauses stay valid whichever order the two files run in."

That reasoning was wrong. Applying against production surfaced a platform
constraint neither migration accounted for:

* D1 always wraps a migration file (even a plain `d1 execute --file`) in an
  already-open transaction. This makes `PRAGMA foreign_keys=OFF` a genuine
  no-op — confirmed by direct reproduction with both raw SQLite and
  `wrangler d1 execute --local`, not just inferred from the docs.
* With FK enforcement therefore always effectively on, `DROP TABLE parent`
  fails immediately with `FOREIGN KEY constraint failed` if any other live
  table still has a plain (non-`CASCADE`) FK clause pointing at it —
  regardless of `defer_foreign_keys`. For an `ON DELETE CASCADE` clause it's
  worse: the drop doesn't error, it silently **cascades**, deleting the
  referencing rows.
* `payments` is referenced by `payment_proofs.payment_id` and
  `payment_refunds.payment_id` (both plain) in addition to being one of the
  9 originally-planned tables. `contracts` is referenced by
  `sign_sessions.contract_token` (`CASCADE`). Both of these were live
  production data, not empty tables — the first production apply attempt
  failed on `orders` (referenced by `payments`, which had live rows), and a
  second attempt would have failed identically on `payments` inside `0129`
  once `orders` was fixed, or silently dropped `sign_sessions` rows via
  `contracts`'s cascade.

The fix: every table that references `payments`, `contracts`, or `orders`
must have that specific FK clause stripped **before** the referenced table is
dropped and rebuilt, in dependency order:

```
payment_proofs, payment_refunds  (children of payments)
  -> payments                      (also drops its own orders reference)
sign_sessions                    (child of contracts)
  -> contracts                     (also drops its own orders reference)
invoices, order_time_change_history, inspection_disputes,
order_fulfillment_records, damage_cases   (orders' remaining plain/CASCADE children)
  -> [0130 rebuilds orders itself, now safe]
```

D1 doesn't enforce these FKs in production anyway (see "Why it matters"
above), and the app already deletes `payments`/`contracts`/`invoices`/
`payment_refunds`/`payment_proofs` explicitly in code
(`src/index.ts`, `/admin/orders/:id/delete`) rather than relying on DB-level
`CASCADE`, so dropping these clauses for good — matching the `users_old`
policy, not attempting to re-add them — changes no production behavior.
`order_time_change_history` and `inspection_disputes` were the only two
`CASCADE`-linked `orders` children the app did **not** already clean up
manually; that handler now deletes them (and `sign_sessions`, for
`contracts`'s cascade) explicitly too, so no orphaned rows accumulate now
that the DB won't do it automatically.

`0129` rebuilds each affected table with the SQLite 12-step pattern, wrapped
in `PRAGMA foreign_keys=OFF/ON` (same family as `0044`/`0060`/`0074`):

```
CREATE TABLE <t>__fk_rebuild ( <clean schema> );
INSERT INTO <t>__fk_rebuild (<cols>) SELECT <cols> FROM <t>;
DROP TABLE <t>;
ALTER TABLE <t>__fk_rebuild RENAME TO <t>;
-- recreate every non-auto index and every trigger verbatim
```

Renaming the `__fk_rebuild` table rather than the original means SQLite never
rewrites child `REFERENCES` clauses. `PRAGMA legacy_alter_table=ON` around
the rename steps is still necessary for a *different* reason than the FK
issue above: it stops SQLite's post-3.25 `RENAME` from re-parsing every
trigger/view in the schema, which would otherwise fail on ones that
reference a table momentarily absent mid-rebuild (e.g.
`deposit_refunds_cannot_exceed_paid_deposit` references `payments` in its
body). It does **not** by itself avoid the FK constraint-check problem —
only the dependency-ordered stripping above does that. This was verified by
directly reproducing the failure with a throwaway local D1 database and a
two-row synthetic schema before touching the real migration files, and again
end-to-end afterward: a fresh `db:migrate:local` from empty (proves
schema/syntax only), and a seeded populated database mirroring production's
exact FK shape (one row in each of `orders`/`payments`/`contracts`/
`payment_proofs`/`payment_refunds`/`sign_sessions`/`invoices`/
`order_time_change_history`/`inspection_disputes`/`order_fulfillment_records`/
`damage_cases`) run through `0129`+`0130`, confirming every row survives and
`PRAGMA foreign_key_check` comes back empty.

Also fixed in passing: the original `0121` draft's `payments__fk_rebuild`
was missing `idx_payments_stripe_payment_intent` (added later by
`0116_stripe_payment_intents.sql`, after the draft was written) — it would
have silently dropped that unique index. `0129` recreates it.

## `orders`: rebuilt by `0130_expand_order_status_check.sql`, after `0129`

`orders` is the hub of the schema:

* **7 child tables** currently FK-reference it — `contracts`, `damage_cases`,
  `inspection_disputes`, `invoices`, `order_fulfillment_records`,
  `order_time_change_history`, `payments` (`commission_records` did too,
  historically) — three of them `ON DELETE CASCADE` (`contracts`,
  `inspection_disputes`, `order_time_change_history`).
* **~58 columns** accreted across dozens of migrations, several with `CHECK`
  constraints and non-obvious defaults.
* 4 non-auto indexes (`idx_orders_deposit_status`, `idx_orders_order_status`,
  `idx_orders_payment_status`, `idx_orders_rental_status`) and the
  `update_orders_updated_at` trigger.

`0130` (originally `0120_expand_order_status_check.sql`, renumbered to run
after `0129`) rebuilds it with the same 12-step pattern (its primary purpose
is expanding the `status` CHECK constraint; the FK cleanup rides along since
it already has to touch every column). Unlike the blanket "drop the clause"
policy above, `0130` **re-points** `userId` → `users(id)` and `deviceId` →
`devices(id)` (keeping `referrerId` → `users(id) ON DELETE SET NULL`)
instead of dropping them outright. That's a deliberate deviation: unlike
`users_old`/`devices_before_retired_status`, the live `users`/`devices`
tables are exactly what `orders.userId`/`orders.deviceId` have always
logically pointed at in application code (every join already assumes this),
so re-pointing there is strictly more correct than leaving no constraint at
all, and D1 doesn't enforce FKs in production regardless. By the time `0130`
runs, `0129` has already stripped every child table's `orders`-referencing
clause, so this `DROP TABLE orders` is safe.

**`0130` must run after `0129`, not before or independently** — this is the
opposite of what the docs previously said, and was the actual root cause of
the original production incident. Renumbering `0130` after `0129` (both
still unapplied at the time) made this ordering explicit in the filenames
rather than relying on it being a lucky lexicographic accident.

## Aside: duplicate migration numbers

`migrations/` has several pairs of files sharing the same leading number
(`0014`, `0102`, `0118`, `0119`, and previously `0120`) — fallout from
independent feature branches each claiming the next available number before
merging into `main`. (The `0120` pair was the one directly involved in this
incident: `0120_richen_email_templates.sql`, unrelated and already applied,
and what was `0120_expand_order_status_check.sql` — now renumbered to
`0130` since it's still unapplied and needed to move anyway. `0121` was
similarly renumbered to `0129`.) This looks alarming but is **not** by
itself a functional bug: `wrangler d1 migrations`
tracks applied migrations by full filename in the `d1_migrations` table, not
by numeric prefix, and applies files in lexicographic order of the full
filename, which is well-defined even for a shared prefix. All of these
duplicate pairs are already applied in production. **Do not rename them** —
renaming an already-applied file desyncs it from the tracking table and makes
wrangler try to reapply it as new. They're left as historical debt,
documented here rather than "fixed", because fixing them would be riskier
than the problem they cause.

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

## What migration 0103 does

`0103_drop_dangling_foreign_keys.sql` rebuilds **10 of the 11 tables** with
the SQLite 12-step pattern, wrapped in `PRAGMA foreign_keys=OFF/ON` (same
family as `0044`/`0060`/`0074`):

```
CREATE TABLE <t>__fk_rebuild ( <clean schema> );
INSERT INTO <t>__fk_rebuild (<cols>) SELECT <cols> FROM <t>;
DROP TABLE <t>;
ALTER TABLE <t>__fk_rebuild RENAME TO <t>;
-- recreate every non-auto index and every trigger verbatim
```

Renaming the `__fk_rebuild` table rather than the original means SQLite never
rewrites child `REFERENCES` clauses, so `contracts` and `payments` (which are
themselves FK targets) can be rebuilt without corrupting `sign_sessions`,
`payment_proofs`, or `payment_refunds`. Verified with a scratch parent/child
pair plus `PRAGMA foreign_key_check`.

## What is deferred: `orders`

`orders` is **not** touched by `0103`. It is the hub of the schema:

* **8 child tables** FK-reference it — `commission_records`, `contracts`,
  `damage_cases`, `inspection_disputes`, `invoices`,
  `order_fulfillment_records`, `order_time_change_history`, `payments` — three
  of them `ON DELETE CASCADE` (`contracts`, `inspection_disputes`,
  `order_time_change_history`).
* **~58 columns** accreted across dozens of migrations, several with `CHECK`
  constraints and non-obvious defaults.
* 4 non-auto indexes (`idx_orders_deposit_status`, `idx_orders_order_status`,
  `idx_orders_payment_status`, `idx_orders_rental_status`) and the
  `update_orders_updated_at` trigger.

All three of its FK clauses are dangling and, per the policy above, all three
would simply be **dropped** — the clean `orders` has no `FOREIGN KEY` clauses
at all. The rebuild itself is mechanically the same 12-step pattern and is
safe in principle, but:

1. The column list must be reproduced exactly; a transcription error is a
   silent data-loss bug in the core rental/finance table.
2. It should be tested against a **populated** database (a fresh
   `db:migrate:local` runs the `INSERT ... SELECT` over zero rows, which
   proves only schema/syntax validity, not data preservation).
3. On remote D1 the `PRAGMA foreign_keys=OFF` window during
   `DROP TABLE orders` / `RENAME` needs a maintenance check, since `orders`
   has inbound `ON DELETE CASCADE` edges.

### Procedure for the follow-up migration (`0104`)

1. Dump the live definition and dependents first:
   ```sql
   SELECT name, sql FROM sqlite_master WHERE sql LIKE '%orders%';
   SELECT cid, name, type, "notnull", dflt_value, pk FROM pragma_table_info('orders');
   ```
2. Build `orders__fk_rebuild` with the identical column list/types/defaults/
   `CHECK`s, **minus** all three `FOREIGN KEY` clauses.
3. `INSERT INTO orders__fk_rebuild (<explicit cols>) SELECT <same cols> FROM orders;`
4. `DROP TABLE orders; ALTER TABLE orders__fk_rebuild RENAME TO orders;`
5. Recreate the 4 indexes and `update_orders_updated_at` verbatim.
6. `PRAGMA foreign_key_check;` — expect zero rows.
7. Verify each of the 8 child tables still shows `REFERENCES orders(id)` (not
   `orders__fk_rebuild`) via `SELECT sql FROM sqlite_master`.
8. `npm run db:migrate:local && npm test && npx tsc --noEmit`, then dry-run
   against a copy of production data before `db:migrate:remote`.

# Isolated test database (integration runs)

The app's configured database is the shared KMITL course server (`DB_HOST` in `.env`), which **cannot** be
used for integration tests: `tests/api.test.js` creates receipts, truncates tables via the seeder and
mutates stock. This document describes the local, throwaway MySQL used instead.

## Where it lives

| | |
| --- | --- |
| Engine | **MySQL 8.0.46** inside the WSL2 `Ubuntu` distro (same version as the shared server) |
| Endpoint | `127.0.0.1:3306` (bind_address is `127.0.0.1`; reachable from Windows through WSL localhost forwarding) |
| Schema | `crwn_st_test` |
| User | `crwn_test` (all privileges on `crwn_st_test` only) |
| Credentials | `.env.isolated` in the repo root — **gitignored**, never committed |

`bind-address=127.0.0.1` and the `%` grant host are safe here because WSL exposes nothing to the LAN.

## Start the database

WSL2 shuts the distro down after ~60s without a running process, which stops `mysqld`. Keep a process
alive for the whole test run:

```bash
# terminal A — keeps the distro (and therefore mysqld) alive; Ctrl-C to release the distro
wsl -u root -d Ubuntu -- bash -lc "service mysql start; exec sleep infinity"
```

Verify before running tests:

```bash
wsl -u root -d Ubuntu -- bash -lc "mysqladmin ping"
```

Stop everything (distro + server): `wsl --shutdown`

## Run the suites

```bash
node tests/run-isolated.js seed   # TRUNCATEs + reseeds crwn_st_test (deterministic starting point)
node tests/run-isolated.js        # node --test --test-force-exit tests/api.test.js
```

`--test-force-exit` is required: the `mysql2` pool keeps the event loop alive, so `node --test` would
otherwise never print its summary or exit.

## Safety gates in `tests/run-isolated.js`

The wrapper loads `.env.isolated` into the child process environment and **refuses to run** unless all of
these hold:

- `DB_HOST` is `127.0.0.1`, `localhost` or `::1`
- `DB_NAME` differs from the app's configured `DB_NAME` in `.env`
- `DB_HOST` differs from the app's configured `DB_HOST`
- `USE_MOCK_DB` and `ISOLATED_TEST_DB` are deleted from the environment, so the guard inside
  `tests/api.test.js` stays armed (it is never used to bypass a live target)

Loading via a wrapper (rather than the shell) also keeps the password out of `argv`, which is
world-readable on this host.

## One-time setup that was performed

```bash
# inside WSL, as root (no sudo prompt needed with -u root)
dpkg --configure -a                       # repair a pre-existing interrupted dpkg run
apt-get update -qq
apt-get install -y mysql-server           # mysql-server-8.0
service mysql start
mysql -e "CREATE DATABASE crwn_st_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
          CREATE USER 'crwn_test'@'%' IDENTIFIED BY '<generated>';
          GRANT ALL PRIVILEGES ON crwn_st_test.* TO 'crwn_test'@'%'; FLUSH PRIVILEGES;"
mysql crwn_st_test < database/schema.sql   # schema.sql already contains the durable-session tables
node tests/run-isolated.js seed
```

`database/migrations/20261015_durable_fitting_sessions.sql` is **redundant after `schema.sql`** — the
schema file already declares `FITTING_ROOM_SESSION`, `FITTING_ROOM_SLOT` and the `FTR_SessionID` /
`FTR_CancelledAt` columns, so applying the migration on top fails with `ERROR 1050 Table ... already
exists`. The two files are kept in sync on purpose; load the migration only against a database created
from an older schema.

## Reproducing from scratch

Drop and recreate the schema, then reload and reseed:

```bash
wsl -u root -d Ubuntu -- bash -lc "mysql -e 'DROP DATABASE crwn_st_test; CREATE DATABASE crwn_st_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;'"
wsl -u root -d Ubuntu -- bash -lc "mysql crwn_st_test < '/mnt/c/Users/sirav/Code/Note/My_Vault/AIOS/03 Projects/crwn.st/database/schema.sql'"
node tests/run-isolated.js seed
```

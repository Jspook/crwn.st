#!/usr/bin/env node
/**
 * Runs the integration suite (or the seeder) against an ISOLATED local MySQL.
 *
 * Why a wrapper: `dotenv.config()` never overrides variables that are already set, so loading
 * .env.isolated here wins over .env. That keeps the real credentials out of the command line
 * (argv is world-readable on this host) and leaves .env untouched.
 *
 * Usage:
 *   node tests/run-isolated.js         # node --test tests/api.test.js
 *   node tests/run-isolated.js seed    # node database/seed.js
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const dotenv = require(path.join(root, 'node_modules', 'dotenv'));
const isolatedPath = path.join(root, '.env.isolated');
const basePath = path.join(root, '.env');

function fail(msg) {
  console.error(`\n[run-isolated] REFUSING TO RUN: ${msg}\n`);
  process.exit(2);
}

if (!fs.existsSync(isolatedPath)) {
  fail(`missing ${isolatedPath}\n  Create it from .env with DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME pointing at a LOCAL MySQL (it is gitignored).`);
}
if (!fs.existsSync(basePath)) fail('missing .env (needed to compare against the configured app database)');

const isolated = dotenv.parse(fs.readFileSync(isolatedPath));
const base = dotenv.parse(fs.readFileSync(basePath));

const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
for (const key of required) {
  if (!isolated[key]) fail(`${key} is missing from .env.isolated`);
}

// Hard safety gates: this must never reach the shared/production database.
const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '::1'];
if (!LOCAL_HOSTS.includes(isolated.DB_HOST)) {
  fail(`DB_HOST="${isolated.DB_HOST}" is not local. Isolated runs must use ${LOCAL_HOSTS.join(' / ')}.`);
}
if (base.DB_NAME && isolated.DB_NAME === base.DB_NAME) {
  fail(`DB_NAME matches the configured app database. Point DB_NAME at a separate schema.`);
}
if (base.DB_HOST && isolated.DB_HOST === base.DB_HOST) {
  fail(`DB_HOST matches the configured app host. Isolated runs must not target the shared server.`);
}

const mode = process.argv[2] || 'test';
const env = { ...process.env, ...isolated };
delete env.USE_MOCK_DB;      // integration mode must use a real connection
delete env.ISOLATED_TEST_DB; // do not disarm the guard inside tests/api.test.js

const commands = {
  // --test-force-exit: the mysql2 pool keeps the event loop alive after the run, so node --test
  // would never print its summary or exit without it.
  test: ['--test', '--test-force-exit', path.join('tests', 'api.test.js')],
  seed: [path.join('database', 'seed.js')],
};
const args = commands[mode];
if (!args) fail(`unknown mode "${mode}" (expected: test | seed)`);

console.log(`[run-isolated] mode=${mode} host=${isolated.DB_HOST}:${isolated.DB_PORT} db=${isolated.DB_NAME} user=${isolated.DB_USER} (password not shown)`);
const result = spawnSync(process.execPath, args, {
  cwd: root,
  env,
  stdio: 'inherit',
  // The isolated database is local, so a short socket timeout is enough to surface a dead server.
  timeout: 15 * 60 * 1000,
});
process.exit(result.status === null ? 1 : result.status);

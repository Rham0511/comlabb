# Scripts Directory

This folder contains utility scripts, test files, and migration helpers used during development.

## Utility Scripts

- `create-admin.js` - Create admin user accounts
- `hash-password.js` - Generate password hashes
- `run-migration.js` - Run database migrations
- `migrate-users-campus.mjs` - Migrate user campus data
- `quick-migrate.sh` / `run-migrations-simple.sh` - Quick migration shell scripts

## Test Scripts

- `test-*.mjs` / `test-*.js` - Various test scripts for features
- `check-*.mjs` - Database and system check scripts
- `diagnose-*.mjs` - Diagnostic scripts
- `final-verification.mjs` - Final verification script

## Temporary Files

- `temp-*.mjs` / `temp-*.js` - Temporary testing scripts
- `tmp_*.js` / `tmp_*.html` / `tmp_*.cjs` - Temporary files

## Usage

Most scripts can be run with:
```bash
node scripts/script-name.mjs
```

Or for shell scripts:
```bash
bash scripts/script-name.sh
```

**Note:** These are development/testing scripts and should not be used in production.

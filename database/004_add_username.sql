-- Adds username-based login (REQ-AUTH-01: "The system shall include a Login
-- screen requiring a username and password"). Previously the app used email
-- as the login identifier; this migration adds a separate username column
-- and backfills it for any existing rows so login can move to it without
-- losing existing accounts. email is kept as a stored contact field but is
-- no longer used to authenticate.
--
-- Re-runnable: guarded so re-applying to an already-migrated database is a
-- no-op, not an error (same convention as 002/003).

ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255);

-- Backfill any pre-existing rows (e.g. a database created before this
-- migration existed) using the local part of their email as a default
-- username. Only touches rows that don't have one yet.
UPDATE users
SET username = split_part(email, '@', 1)
WHERE username IS NULL;

-- Enforce uniqueness once backfilled.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_username_unique'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_username_unique UNIQUE (username);
    END IF;
END $$;

ALTER TABLE users ALTER COLUMN username SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

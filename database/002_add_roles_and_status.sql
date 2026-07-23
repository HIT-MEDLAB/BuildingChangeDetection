-- Migration 002: PRD completion sprint (Jul 20-26)
-- Adds: user roles/access management (US-6), case status classification (US-4).
-- Run this after 001_initial_schema.sql. Safe to re-run (IF NOT EXISTS / guarded ALTERs).

-- --- US-6: Roles & admin access management ---------------------------------

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'inspector';

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_role_check CHECK (role IN ('inspector', 'admin'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- --- US-4: Case status classification ---------------------------------------
-- Distinct from `inspections.status`, which reflects ML processing state
-- (pending/processing/completed/failed). `case_status` is the inspector's
-- enforcement decision and defaults to 'under_review' until classified.

ALTER TABLE inspections
    ADD COLUMN IF NOT EXISTS case_status VARCHAR(20) NOT NULL DEFAULT 'under_review';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'inspections_case_status_check'
    ) THEN
        ALTER TABLE inspections
            ADD CONSTRAINT inspections_case_status_check
            CHECK (case_status IN ('under_review', 'confirmed', 'dismissed'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inspections_case_status ON inspections(case_status);

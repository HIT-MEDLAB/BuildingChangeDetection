-- Migration 003: PRD gap closure (Jul 27 - Aug 2)
-- Adds: server-generated processed (result) image storage (REQ-CORE-03/04/05).
-- Run this after 001_initial_schema.sql and 002_add_roles_and_status.sql.
-- Safe to re-run (IF NOT EXISTS).

-- --- REQ-CORE-04: history must record the Reference, Current, and
-- --- Processed (Result) Image, alongside the timestamp (already present). ---

ALTER TABLE inspections
    ADD COLUMN IF NOT EXISTS processed_image_path VARCHAR(500);

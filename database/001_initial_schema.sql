-- Initial database schema for Building Change Detection
-- This file runs automatically when PostgreSQL starts for the first time
-- via docker-compose (mounted into /docker-entrypoint-initdb.d/)

-- TODO: Students — review this schema and adjust column types, constraints,
-- and relationships based on the PRD requirements.

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inspections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    building_id VARCHAR(255),  -- TODO: Decide if this should be required / foreign key
    status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- pending, processing, completed, failed
    notes TEXT,
    image_before_path VARCHAR(500),
    image_after_path VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inspection_results (
    id SERIAL PRIMARY KEY,
    inspection_id INTEGER NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    changes_detected BOOLEAN NOT NULL DEFAULT FALSE,
    result_data JSONB,  -- Store bounding boxes, confidence scores, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TODO: Add indexes as needed based on query patterns
-- Example: CREATE INDEX idx_inspections_user_id ON inspections(user_id);
-- Example: CREATE INDEX idx_inspections_status ON inspections(status);

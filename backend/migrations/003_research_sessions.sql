-- ThinkSync OS — Research Sessions Table Migration
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS research_sessions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query        TEXT NOT NULL,
    report       TEXT,
    sources      JSONB DEFAULT '[]'::jsonb,
    sub_queries  JSONB DEFAULT '[]'::jsonb,
    confidence   FLOAT DEFAULT 0.0,
    total_sources INT DEFAULT 0,
    depth        INT DEFAULT 3,
    duration_ms  INT DEFAULT 0,
    status       TEXT DEFAULT 'complete',
    related_queries JSONB DEFAULT '[]'::jsonb,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast listing (most recent first)
CREATE INDEX IF NOT EXISTS idx_research_sessions_created
    ON research_sessions (created_at DESC);

-- Index for full-text search on queries
CREATE INDEX IF NOT EXISTS idx_research_sessions_query
    ON research_sessions USING gin(to_tsvector('english', query));

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_research_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_research_sessions_updated_at ON research_sessions;
CREATE TRIGGER trg_research_sessions_updated_at
    BEFORE UPDATE ON research_sessions
    FOR EACH ROW EXECUTE FUNCTION update_research_sessions_updated_at();

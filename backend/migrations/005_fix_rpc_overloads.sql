-- ThinkSync OS — Fix RPC Overload Ambiguity (Migration 005)
-- Run this in Supabase SQL Editor
--
-- Problem: Two versions of match_rag_chunks / match_chunks exist with
-- the same parameters but different argument order — PostgREST can't
-- choose between them (PGRST203).
-- Solution: Drop ALL overloads, re-create the single canonical version.

-- ── Drop all overloads of match_rag_chunks ────────────────────────────────────

DROP FUNCTION IF EXISTS match_rag_chunks(vector, integer, double precision);
DROP FUNCTION IF EXISTS match_rag_chunks(vector, double precision, integer);
DROP FUNCTION IF EXISTS match_rag_chunks(vector(768), int, float);
DROP FUNCTION IF EXISTS match_rag_chunks(query_embedding vector, match_count int, match_threshold float);
DROP FUNCTION IF EXISTS match_rag_chunks(query_embedding vector, match_threshold float, match_count int);

-- Re-create the single canonical version
CREATE OR REPLACE FUNCTION match_rag_chunks(
    query_embedding vector(768),
    match_count     int     DEFAULT 8,
    match_threshold float   DEFAULT 0.3
)
RETURNS TABLE (
    id            uuid,
    content       text,
    document_id   uuid,
    chunk_index   int,
    similarity    float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.content,
        c.document_id,
        c.chunk_index,
        1 - (c.embedding <=> query_embedding) AS similarity
    FROM chunks c
    INNER JOIN documents d ON d.id = c.document_id
    WHERE d.category = 'rag_agent'
      AND 1 - (c.embedding <=> query_embedding) > match_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;


-- ── Drop all overloads of match_chunks ───────────────────────────────────────

DROP FUNCTION IF EXISTS match_chunks(vector, integer, double precision);
DROP FUNCTION IF EXISTS match_chunks(vector, double precision, integer);
DROP FUNCTION IF EXISTS match_chunks(vector(768), int, float);
DROP FUNCTION IF EXISTS match_chunks(query_embedding vector, match_count int, match_threshold float);
DROP FUNCTION IF EXISTS match_chunks(query_embedding vector, match_threshold float, match_count int);

-- Re-create the single canonical version
CREATE OR REPLACE FUNCTION match_chunks(
    query_embedding vector(768),
    match_count     int   DEFAULT 10,
    match_threshold float DEFAULT 0.1
)
RETURNS TABLE (
    id            uuid,
    content       text,
    document_id   uuid,
    chunk_index   int,
    similarity    float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.content,
        c.document_id,
        c.chunk_index,
        1 - (c.embedding <=> query_embedding) AS similarity
    FROM chunks c
    WHERE 1 - (c.embedding <=> query_embedding) > match_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

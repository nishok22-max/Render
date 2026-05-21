-- Aetheris OS — Performance Indexes (Sprint 4)
-- Run this in Supabase SQL Editor

-- ── Vector search performance ──────────────────────────────────────────────────

-- IVFFlat index for chunks embedding search (faster approximate search)
-- Trains on existing vectors — run AFTER you have >1000 chunks
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_ivfflat
    ON chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- ── Document lookup performance ───────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_chunks_document_id
    ON chunks (document_id);

CREATE INDEX IF NOT EXISTS idx_chunks_document_category
    ON chunks (document_id, chunk_index);

CREATE INDEX IF NOT EXISTS idx_documents_category
    ON documents (category);

CREATE INDEX IF NOT EXISTS idx_documents_status
    ON documents (status, created_at DESC);

-- ── Session memory performance ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_messages_session_id
    ON messages (session_id, created_at DESC);

-- ── Research sessions performance (from Sprint 1 migration) ──────────────────

CREATE INDEX IF NOT EXISTS idx_research_sessions_created
    ON research_sessions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_research_sessions_query_gin
    ON research_sessions USING gin(to_tsvector('english', query));

-- ── Composite index for category-scoped vector search ────────────────────────
-- Enables match_rag_chunks to use index scan + filter efficiently

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


-- ── Generic match function (used for non-category searches) ──────────────────

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

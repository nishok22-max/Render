-- ThinkSync OS — Fix RAG Retrieval Functions
-- Run this in the Supabase SQL Editor AFTER 001_init.sql and 002_rag_agent.sql
--
-- Fixes:
--   1. match_chunks now returns document_id (needed for post-filtering)
--   2. match_rag_chunks recreated with lower default threshold
--   3. Added keyword search function as fallback

-- Fix 1: match_chunks returns document_id
CREATE OR REPLACE FUNCTION match_chunks(
    query_embedding vector(768),
    match_threshold FLOAT DEFAULT 0.3,
    match_count INT DEFAULT 10
)
RETURNS TABLE (id UUID, content TEXT, similarity FLOAT, metadata JSONB, document_id UUID)
AS $$
BEGIN
    RETURN QUERY
    SELECT c.id, c.content, 1 - (c.embedding <=> query_embedding) AS similarity, c.metadata, c.document_id
    FROM chunks c
    WHERE c.embedding IS NOT NULL
      AND 1 - (c.embedding <=> query_embedding) > match_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Fix 2: match_rag_chunks with lower default threshold
CREATE OR REPLACE FUNCTION match_rag_chunks(
    query_embedding vector(768),
    match_threshold FLOAT DEFAULT 0.3,
    match_count INT DEFAULT 10
)
RETURNS TABLE (id UUID, content TEXT, similarity FLOAT, metadata JSONB, document_id UUID)
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.content,
        1 - (c.embedding <=> query_embedding) AS similarity,
        c.metadata,
        c.document_id
    FROM chunks c
    INNER JOIN documents d ON d.id = c.document_id
    WHERE d.category = 'rag_agent'
      AND c.embedding IS NOT NULL
      AND 1 - (c.embedding <=> query_embedding) > match_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Fix 3: Add chunk_count column if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'documents' AND column_name = 'chunk_count'
    ) THEN
        ALTER TABLE documents ADD COLUMN chunk_count INTEGER DEFAULT 0;
    END IF;
END $$;

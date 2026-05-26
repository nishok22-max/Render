-- ThinkSync OS — RAG Agent Isolated Vector Search
-- Run this in the Supabase SQL Editor AFTER 001_init.sql
--
-- This function restricts similarity search to documents with category='rag_agent'
-- so the RAG Agent knowledge base is fully isolated from the main chat pipeline.

CREATE OR REPLACE FUNCTION match_rag_chunks(
    query_embedding vector(768),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5
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
      AND 1 - (c.embedding <=> query_embedding) > match_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Add chunk_count column if it doesn't exist (used by ingestion pipeline)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'documents' AND column_name = 'chunk_count'
    ) THEN
        ALTER TABLE documents ADD COLUMN chunk_count INTEGER DEFAULT 0;
    END IF;
END $$;

/**
 * ThinkSync OS â€” RAG Agent Service
 * Handles RAG KB uploads, SSE queries, document management, and stats.
 * Fully isolated from the main chatService.
 */
import api from './api';
import { API_BASE_URL } from '../utils/constants';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface RagDocument {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: string;
  created_at: string;
}

export interface RagCitation {
  index: number;
  content: string;
  similarity: number;
  document_id: string;
}

export interface RagSource {
  id: string;
  filename: string;
}

export interface RagStats {
  total_documents: number;
  total_size_bytes: number;
  parsed: number;
  processing: number;
  errors: number;
}

// â”€â”€â”€ Service â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const ragService = {
  /**
   * Upload a file to the RAG Agent isolated knowledge base.
   */
  async upload(
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<{ document_id: string; filename: string; status: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await api.post('/rag/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (event.total && onProgress) {
          onProgress(Math.round((event.loaded * 100) / event.total));
        }
      },
    });

    return data;
  },

  /**
   * Query the RAG Agent KB via SSE streaming.
   * Callbacks:
   *   onToken     â€” streamed text tokens
   *   onCitations â€” source citations + document references
   *   onRetrieval â€” retrieval metadata (total chunks, sources)
   *   onStatus    â€” status messages ("Searching knowledge base...")
   *   onError     â€” error message
   *   onComplete  â€” full response text when stream ends
   */
  async query(
    question: string,
    callbacks: {
      onToken: (token: string) => void;
      onCitations?: (citations: RagCitation[], sources: RagSource[]) => void;
      onRetrieval?: (total: number, sources: RagSource[]) => void;
      onStatus?: (message: string) => void;
      onError?: (error: string) => void;
      onComplete?: (fullText: string) => void;
    },
    topK?: number,
  ): Promise<() => void> {
    const abortController = new AbortController();
    let fullContent = '';

    const baseUrl = API_BASE_URL.replace(/\/api$/, '');

    try {
      const response = await fetch(`${baseUrl}/api/rag/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, top_k: topK || 5 }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        callbacks.onError?.(`Server error: ${response.status} â€” ${errText}`);
        return () => abortController.abort();
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        callbacks.onError?.('No response stream available');
        return () => abortController.abort();
      }

      let buffer = '';

      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();

              if (data === '[DONE]') {
                callbacks.onComplete?.(fullContent);
                return;
              }

              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'token') {
                  fullContent += parsed.content;
                  callbacks.onToken(parsed.content);
                } else if (parsed.type === 'citations') {
                  callbacks.onCitations?.(parsed.citations || [], parsed.sources || []);
                } else if (parsed.type === 'retrieval') {
                  callbacks.onRetrieval?.(parsed.total_chunks || 0, parsed.sources || []);
                } else if (parsed.type === 'status') {
                  callbacks.onStatus?.(parsed.message);
                } else if (parsed.type === 'error') {
                  callbacks.onError?.(parsed.message);
                  return;
                }
              } catch {
                fullContent += data;
                callbacks.onToken(data);
              }
            }
          }
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            callbacks.onError?.(err.message || 'Stream error');
          }
        }
      };

      processStream();
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        callbacks.onError?.(err.message || 'Connection error');
      }
    }

    return () => abortController.abort();
  },

  /**
   * List all documents in the RAG KB.
   */
  async getDocuments(): Promise<RagDocument[]> {
    const { data } = await api.get('/rag/documents');
    return data.documents || [];
  },

  /**
   * Delete a document from the RAG KB.
   */
  async deleteDocument(docId: string): Promise<void> {
    await api.delete(`/rag/documents/${docId}`);
  },

  /**
   * Get KB statistics.
   */
  async getStats(): Promise<RagStats> {
    const { data } = await api.get('/rag/stats');
    return data;
  },

  /**
   * Get smart question suggestions.
   */
  async getSuggestions(): Promise<string[]> {
    const { data } = await api.get('/rag/suggestions');
    return data.suggestions || [];
  },
};

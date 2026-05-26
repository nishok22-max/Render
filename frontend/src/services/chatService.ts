import api from './api';
import { API_BASE_URL } from '../utils/constants';
import type { Message } from '../store/chatStore';
import type { ImageAttachment } from '../store/uploadStore';

export interface ChatAttachment {
  filename: string;
  file_type: string;
  content: string;       // base64 data-URL for images, empty for documents
  mime_type: string;
}

export interface ChatRequest {
  message: string;
  session_id?: string;
  attachments?: ChatAttachment[];
}

export interface ChatResponse {
  session_id: string;
  message: Message;
}

/**
 * Build the attachments payload from global image attachments.
 * Only includes images that are fully loaded (status === 'ready').
 */
function buildAttachments(images: ImageAttachment[]): ChatAttachment[] {
  return images
    .filter((img) => img.status === 'ready' && img.base64)
    .map((img) => ({
      filename: img.filename,
      file_type: img.filename.split('.').pop()?.toLowerCase() || 'png',
      content: img.base64,     // full data-URL, e.g. "data:image/png;base64,..."
      mime_type: img.mimeType,
    }));
}

export interface AgentStatusEvent {
  agent: string;
  pipeline: string[];
  input_type: string;
}

export interface CitationsEvent {
  citations: { title: string; url: string }[];
  sources: { title: string; url: string; snippet?: string }[];
}

export const chatService = {
  /**
   * Send a message (with optional image attachments) and stream the response via SSE.
   * New callbacks:
   *   onAgentStatus  â€” fired when the orchestrator announces which agent is handling the request
   *   onCitations    â€” fired when the agent returns source citations
   */
  async sendMessage(
    request: ChatRequest,
    onToken: (token: string) => void,
    onComplete: (response: ChatResponse) => void,
    onError: (error: string) => void,
    onReasoning?: (step: any) => void,
    onAgentStatus?: (status: AgentStatusEvent) => void,
    onCitations?: (citations: CitationsEvent) => void,
  ): Promise<() => void> {
    const abortController = new AbortController();

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const err = await response.json();
        onError(err.detail || 'Chat request failed');
        return () => {};
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        onError('No response stream');
        return () => {};
      }

      let fullContent = '';
      let sessionId = request.session_id || '';
      // Stable ID used for both streaming updates and the final onComplete event,
      // so the in-memory message and any persistence both reference the same ID.
      const assistantMsgId = crypto.randomUUID();
      // SSE buffer â€” accumulates raw bytes until a complete event (\n\n boundary)
      let sseBuffer = '';

      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            sseBuffer += decoder.decode(value, { stream: true });

            // SSE events are separated by double-newline (\n\n).
            // Only process complete events; keep the incomplete tail in the buffer.
            const events = sseBuffer.split('\n\n');
            // Last element is either empty (if buffer ended with \n\n) or an
            // incomplete event that needs more data â€” keep it in the buffer.
            sseBuffer = events.pop() ?? '';

            for (const eventBlock of events) {
              // Each block may have multiple "data: ..." lines; join them.
              const dataLine = eventBlock
                .split('\n')
                .filter((l) => l.startsWith('data: '))
                .map((l) => l.slice(6))
                .join('');

              if (!dataLine) continue;

              if (dataLine === '[DONE]') {
                onComplete({
                  session_id: sessionId,
                  message: {
                    id: assistantMsgId,   // stable ID â€” same as used during streaming
                    role: 'assistant',
                    content: fullContent,
                    timestamp: new Date().toISOString(),
                  },
                });
                return;
              }

              try {
                const parsed = JSON.parse(dataLine);
                if (parsed.type === 'token') {
                  const tokenText = typeof parsed.content === 'string'
                    ? parsed.content
                    : (parsed.content != null ? JSON.stringify(parsed.content) : '');
                  fullContent += tokenText;
                  onToken(tokenText);
                } else if (parsed.type === 'agent_status') {
                  onAgentStatus?.({
                    agent: parsed.agent,
                    pipeline: parsed.pipeline || [],
                    input_type: parsed.input_type || '',
                  });
                } else if (parsed.type === 'citations') {
                  onCitations?.({
                    citations: parsed.citations || [],
                    sources: parsed.sources || [],
                  });
                } else if (parsed.type === 'reasoning') {
                  onReasoning?.(parsed.step);
                } else if (parsed.type === 'session') {
                  sessionId = parsed.session_id;
                } else if (parsed.type === 'error') {
                  const errMsg = typeof parsed.message === 'string'
                    ? parsed.message
                    : (parsed.message != null ? JSON.stringify(parsed.message) : 'Unknown error');
                  onError(errMsg);
                  return;
                }
              } catch {
                // Plain-text data line â€” treat as a token (unlikely but safe)
                if (dataLine && dataLine !== '[DONE]') {
                  fullContent += dataLine;
                  onToken(dataLine);
                }
              }
            }
          }
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            onError(err.message || 'Stream error');
          }
        }
      };

      processStream();

      return () => abortController.abort();
    } catch (err: any) {
      onError(err.message || 'Failed to connect');
      return () => {};
    }
  },

  /** Build attachments payload from image store data */
  buildAttachments,

  // â”€â”€â”€ Session Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /** List all chat sessions */
  async getSessions(type?: string) {
    const params = type ? { type } : {};
    const { data } = await api.get('/sessions', { params });
    return data.sessions || [];
  },

  /** Create a new session */
  async createSession(title: string = 'New Chat', type: string = 'chat') {
    const { data } = await api.post('/sessions', { title, type });
    return data; // { id, title, type }
  },

  /** Get messages for a session */
  async getSessionMessages(sessionId: string): Promise<Message[]> {
    const { data } = await api.get(`/sessions/${sessionId}/messages`);
    return (data.messages || []).map((m: any) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.created_at || new Date().toISOString(),
    }));
  },

  /** Save a single message to a session */
  async saveMessage(sessionId: string, role: string, content: string) {
    try {
      await api.post(`/sessions/${sessionId}/messages`, { role, content });
    } catch (e) {
      console.warn('[ThinkSync] Failed to persist message:', e);
    }
  },

  /** Auto-generate a smart title for a session based on user's first message */
  async generateTitle(sessionId: string, message: string): Promise<string> {
    try {
      const { data } = await api.post(`/sessions/${sessionId}/generate-title`, { message });
      return data.title || message.slice(0, 40);
    } catch (e) {
      console.warn('[ThinkSync] Title generation failed:', e);
      return message.slice(0, 40);
    }
  },

  /** Update session title (manual rename) */
  async updateSession(sessionId: string, title: string) {
    try {
      await api.patch(`/sessions/${sessionId}`, { title });
    } catch (e) {
      console.warn('[ThinkSync] Failed to update session:', e);
    }
  },

  /** Delete a session and its messages */
  async deleteSession(sessionId: string) {
    try {
      await api.delete(`/sessions/${sessionId}`);
    } catch (e) {
      console.warn('[ThinkSync] Failed to delete session:', e);
    }
  },
};

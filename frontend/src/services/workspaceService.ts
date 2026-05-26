import api from './api';
import { API_ROUTES } from './apiRoutes';

export interface DashboardStats {
  total_documents: number;
  parsed_documents: number;
  total_vectors: number;
  total_sessions: number;
}

export interface Document {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: 'processing' | 'parsed' | 'error' | 'empty';
  chunk_count?: number;
  created_at: string;
}

export interface Session {
  id: string;
  title: string;
  type: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export const workspaceService = {
  async getStats(): Promise<DashboardStats> {
    try {
      const { data } = await api.get(API_ROUTES.ANALYTICS_DASHBOARD);
      return data;
    } catch {
      return { total_documents: 0, parsed_documents: 0, total_vectors: 0, total_sessions: 0 };
    }
  },

  async getDocuments(): Promise<Document[]> {
    try {
      const { data } = await api.get(API_ROUTES.DOCUMENTS);
      return data.documents || [];
    } catch {
      return [];
    }
  },

  async getSessions(limit = 6): Promise<Session[]> {
    try {
      const { data } = await api.get(API_ROUTES.SESSIONS);
      return (data.sessions || []).slice(0, limit);
    } catch {
      return [];
    }
  },

  async deleteDocument(id: string) {
    await api.delete(API_ROUTES.DOCUMENT(id));
  },

  formatFileSize(bytes: number): string {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  },

  timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins < 2)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  },
};

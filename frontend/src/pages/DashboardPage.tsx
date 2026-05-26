import { useEffect, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { Hero } from '../components/dashboard/Hero';
import { QuickActions } from '../components/dashboard/QuickActions';
import { DocumentList } from '../components/dashboard/DocumentList';
import { ActivityFeed } from '../components/dashboard/AgentsGrid';
import { workspaceService, type DashboardStats, type Session, type Document } from '../services/workspaceService';

export const DashboardPage = () => {
  const [stats, setStats] = useState<DashboardStats>({
    total_documents: 0,
    parsed_documents: 0,
    total_vectors: 0,
    total_sessions: 0,
  });
  const [sessions, setSessions]   = useState<Session[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading]     = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [s, d, st] = await Promise.all([
      workspaceService.getSessions(8),
      workspaceService.getDocuments(),
      workspaceService.getStats(),
    ]);
    setSessions(s);
    setDocuments(d);
    setStats(st);
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  // Load on mount
  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-refresh every 30s (catches processing docs completing)
  useEffect(() => {
    const id = setInterval(fetchAll, 30000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const handleDeleteDocument = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    setStats((prev) => ({
      ...prev,
      total_documents: Math.max(0, prev.total_documents - 1),
      parsed_documents: Math.max(0, prev.parsed_documents - (documents.find((d) => d.id === id)?.status === 'parsed' ? 1 : 0)),
    }));
  };

  return (
    <div className="p-10 lg:p-14 xl:p-18 min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Refresh bar */}
      <div className="flex justify-end mb-6">
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-white/20 hover:text-primary transition-all font-mono disabled:opacity-40"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading...' : `Updated ${lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
        </button>
      </div>

      <Hero stats={stats} />
      <QuickActions />

      <div className="grid grid-cols-12 gap-px bg-white/5 border-y border-white/5 mb-16">
        {/* Left Column */}
        <div className="col-span-12 lg:col-span-8 flex flex-col border-r border-white/5">
          <div className="flex-1">
            <DocumentList documents={documents} onDelete={handleDeleteDocument} />
          </div>
        </div>

        {/* Right Column */}
        <div className="col-span-12 lg:col-span-4 flex flex-col">
          <div className="flex-1">
            <ActivityFeed sessions={sessions} documents={documents} />
          </div>
        </div>
      </div>

      <footer className="mt-auto border-t border-white/5 pt-8 flex justify-between items-center opacity-30 tracking-luxury text-[9px] italic">
        <div>ThinkSync OS v1.0</div>
        <div>Â© 2026 ThinkSync â€¢ All sessions are private</div>
      </footer>
    </div>
  );
};

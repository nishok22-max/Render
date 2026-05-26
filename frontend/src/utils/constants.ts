// Route paths
export const ROUTES = {
  DASHBOARD: '/',
  CHAT: '/chat',
  RESEARCH: '/research',
  RAG_AGENT: '/rag-agent',
  AGENTS: '/agents',
  ANALYTICS: '/analytics',
  SETTINGS: '/settings',
  UPLOAD: '/upload',
} as const;

// API config
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// File type categories
export const FILE_CATEGORIES = {
  IMAGE: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'tif', 'gif'],
  DOCUMENT: ['pdf', 'docx', 'txt', 'md', 'xml', 'yaml', 'yml'],
  DATASET: ['csv', 'xlsx', 'xls', 'xlsm', 'xlsb', 'json', 'jsonl', 'ndjson', 'tsv', 'psv', 'dat'],
  CODE: ['py', 'java', 'js', 'ts', 'c', 'cpp', 'html', 'css', 'sql'],
  COMPRESSED: ['zip'],
  COLUMNAR: ['parquet', 'orc', 'avro', 'feather', 'arrow'],
  DATABASE: ['sqlite', 'db'],
  SCIENTIFIC: ['hdf5', 'h5', 'mat', 'pkl', 'pickle', 'joblib', 'npy', 'npz'],
} as const;

// Agent names
export const AGENTS = {
  ORCHESTRATOR: 'orchestrator',
  DEEP_RESEARCH: 'deep_research',
  RAG_KNOWLEDGE: 'rag_knowledge',
  VISION: 'vision',
  FILE_PROCESSOR: 'file_processor',
  CODE_INTELLIGENCE: 'code_intelligence',
  DATASET_ANALYSIS: 'dataset_analysis',
  WEB_RESEARCH: 'web_research',
  REASONING: 'reasoning',
} as const;

// RAG configuration is server-controlled via backend/app_config.py
// Do NOT define frontend RAG constants to avoid config drift.

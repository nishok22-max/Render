<div align="center">

# ⚡ Aetheris OS

**Multimodal Autonomous Research Agent Platform**

*An intelligent, full-stack AI operating system powered by AWS Bedrock (Kimi K2.5) with Google Gemini fallback — featuring a live orchestrator pipeline, RAG knowledge retrieval, vision analysis, deep web research, and code intelligence.*

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-pgvector-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![AWS Bedrock](https://img.shields.io/badge/AWS-Bedrock-FF9900?style=flat-square&logo=amazonaws)](https://aws.amazon.com/bedrock/)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Agent Fleet](#-agent-fleet)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Environment Variables](#-environment-variables)
- [Database Setup](#-database-setup)
- [Running the Application](#-running-the-application)
- [API Reference](#-api-reference)
- [Frontend Pages](#-frontend-pages)
- [LLM Provider Strategy](#-llm-provider-strategy)
- [RAG Pipeline](#-rag-pipeline)
- [SSE Streaming Protocol](#-sse-streaming-protocol)

---

## 🌐 Overview

Aetheris OS is a premium, full-stack AI agent platform that routes every user query through an intelligent **Orchestrator** to the most appropriate specialized agent. It features:

- 🔀 **Live Orchestrator** — intent detection that picks the right agent pipeline per query
- 🔍 **Deep Research** — multi-step autonomous web research with sub-query synthesis
- 🧠 **RAG Knowledge** — semantic document retrieval via Supabase pgvector
- 👁 **Vision Analysis** — multimodal image understanding (Bedrock + Gemini Vision)
- 💻 **Code Intelligence** — code review, debugging, optimization, documentation
- 📄 **File Processor** — document parsing pipeline (PDF, DOCX, CSV, code files)
- 🌊 **SSE Streaming** — real-time token streaming with live agent status badges
- 💬 **Session Memory** — per-session conversation history injected into every prompt

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React + Vite)                 │
│  localhost:3000                                              │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │Dashboard │ │ AI Chat  │ │ Research │ │Upload/Agents  │  │
│  │          │ │          │ │          │ │Analytics/Stgs │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
│          │           │           │              │            │
│     chatService ─────┴─── SSE Stream ──── uploadService    │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP / SSE
┌──────────────────────────▼──────────────────────────────────┐
│                  BACKEND (FastAPI + Uvicorn)                 │
│  localhost:8000/api                                          │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │               Orchestrator (intent router)            │  │
│  │  detect_intent() → route_request() → agent pipeline   │  │
│  └──────┬──────────┬──────────┬──────────┬───────────────┘  │
│         │          │          │          │                    │
│  ┌──────▼──┐ ┌─────▼──┐ ┌────▼───┐ ┌───▼──────────────┐    │
│  │ Vision  │ │  Deep  │ │  RAG   │ │ Code Intelligence │    │
│  │ Agent   │ │Research│ │ Agent  │ │     Agent         │    │
│  └──────┬──┘ └─────┬──┘ └────┬───┘ └───────────────────┘    │
│         │          │          │                               │
│  ┌──────▼──────────▼──────────▼──────────────────────────┐  │
│  │                    LLM Service                         │  │
│  │   Primary: AWS Bedrock (moonshotai.kimi-k2.5)         │  │
│  │   Fallback: Google Gemini (gemini-3-flash-preview)    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─────────────────┐   ┌────────────────────────────────┐   │
│  │  Session Memory │   │        RAG Pipeline            │   │
│  │  (in-memory,    │   │  embeddings → vector store     │   │
│  │  50 msg window) │   │  (Supabase pgvector)           │   │
│  └─────────────────┘   └────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
              ┌────────────▼───────────────┐
              │     Supabase (PostgreSQL)  │
              │  pgvector extension        │
              │  Tables: documents, chunks │
              │          sessions, messages│
              │          research_history  │
              │          memory            │
              └────────────────────────────┘
```

---

## 🤖 Agent Fleet

| Agent | Trigger | Pipeline | Output |
|---|---|---|---|
| **Orchestrator** | Every request | Routes all others | Agent status SSE events |
| **Deep Research** | Research keywords + long query | `web_research → rag → deep_research` | Markdown report + citations |
| **RAG Knowledge** | General queries (default) | `rag_knowledge` | Grounded answer with sources |
| **Vision Analysis** | Image attachment | `vision` | Image description/analysis |
| **Code Intelligence** | Code keywords / code file | `code_intelligence` | Review, debug, optimize |
| **File Processor** | Document upload | `file_processor → rag` | Parsed chunks → vector store |
| **Web Research** | Sub-agent of Deep Research | Tavily API search | Snippets + citations |
| **General Chat** | Short greetings | `general_chat` | Direct LLM stream |

### Intent Routing Logic

```
User Message
    │
    ├─ Has image attachment?     → vision agent
    ├─ Has code file?            → code_intelligence agent
    ├─ Has document/PDF?         → file_processor → rag_knowledge
    ├─ Has dataset (CSV/JSON)?   → dataset_analysis agent
    │
    ├─ Research keywords + len > 30?  → deep_research pipeline
    ├─ Code keywords?                 → code_intelligence
    ├─ Short greeting (< 60 chars)?   → general_chat (direct stream)
    └─ Default                        → rag_knowledge
```

---

## 🛠 Tech Stack

### Backend
| Component | Technology |
|---|---|
| Framework | FastAPI 0.115 + Uvicorn |
| Language | Python 3.11+ |
| Primary LLM | AWS Bedrock — `moonshotai.kimi-k2.5` |
| Fallback LLM | Google Gemini (`gemini-3-flash-preview`, `gemini-2.5-flash`) |
| Vector DB | Supabase + pgvector (`vector(768)`) |
| Embeddings | Gemini `text-embedding-004` (v1 API) with fallback chain |
| Web Search | Tavily API |
| File Parsing | pypdf, python-docx, pandas |
| Auth signing | AWS Signature V4 (pure stdlib, no botocore) |
| Streaming | SSE via `StreamingResponse` |

### Frontend
| Component | Technology |
|---|---|
| Framework | React 19 + Vite 6 |
| Language | TypeScript 5.8 |
| Styling | TailwindCSS 4 |
| Routing | React Router v7 |
| State | Zustand 5 |
| Animations | Motion (Framer Motion) |
| Markdown | react-markdown + rehype-highlight + remark-gfm |
| Icons | Lucide React |

---

## 📁 Project Structure

```
aetheris-os/
├── backend/                        # FastAPI backend
│   ├── main.py                     # App entry point, route registration, lifespan
│   ├── app_config.py               # Settings from .env (AWS, Gemini, Supabase, etc.)
│   ├── requirements.txt            # Python dependencies
│   ├── .env                        # Secrets (git-ignored)
│   ├── .env.example                # Template for environment variables
│   │
│   ├── agents/                     # Specialized AI agents
│   │   ├── orchestrator.py         # Intent detection + pipeline executor (route_request)
│   │   ├── deep_research_agent.py  # Multi-step web research + synthesis
│   │   ├── rag_agent.py            # RAG retrieval with graceful LLM fallback
│   │   ├── vision_agent.py         # Image analysis via LLM service
│   │   ├── code_agent.py           # Code explain / debug / optimize / review
│   │   ├── file_processor.py       # Document parsing + chunking
│   │   ├── dataset_agent.py        # CSV/JSON/XLSX analysis
│   │   └── web_research_agent.py   # Tavily web search integration
│   │
│   ├── routes/                     # FastAPI route handlers
│   │   ├── chat.py                 # POST /api/chat — SSE streaming via orchestrator
│   │   ├── research.py             # POST /api/research — deep research stream
│   │   ├── upload.py               # POST /api/upload — file ingestion pipeline
│   │   ├── documents.py            # GET/DELETE /api/documents
│   │   ├── sessions.py             # GET/POST /api/sessions
│   │   ├── agents.py               # GET /api/agents — agent fleet status
│   │   ├── vision.py               # POST /api/vision
│   │   ├── code_analysis.py        # POST /api/code-analysis
│   │   ├── dataset_analysis.py     # POST /api/dataset-analysis
│   │   ├── ai_utils.py             # Shared AI utilities
│   │   └── health.py               # GET /api/health
│   │
│   ├── services/
│   │   └── llm_service.py          # Primary LLM: Bedrock → Gemini fallback
│   │                               # generate(), generate_stream(), analyze_image()
│   │
│   ├── rag/                        # RAG pipeline
│   │   ├── embeddings.py           # Gemini embedding with v1/v1beta fallback chain
│   │   ├── retriever.py            # Query → embed → similarity search (never raises)
│   │   ├── vector_store.py         # Supabase pgvector CRUD + match_chunks RPC
│   │   └── chunker.py              # Text splitting utilities
│   │
│   ├── memory/
│   │   └── session_memory.py       # In-memory conversation history (50 msg window)
│   │
│   ├── migrations/
│   │   └── 001_init.sql            # Supabase schema (pgvector, HNSW indexes)
│   │
│   └── uploads/                    # Uploaded files (git-ignored)
│
├── src/                            # React frontend
│   ├── App.tsx                     # Router + page layout
│   ├── main.tsx                    # Entry point
│   ├── index.css                   # Global styles + design tokens
│   │
│   ├── pages/
│   │   ├── ChatPage.tsx            # Main chat UI + live agent badge + SSE consumer
│   │   ├── ResearchPage.tsx        # Deep research interface
│   │   ├── UploadPage.tsx          # Drag-and-drop file uploader
│   │   ├── AgentsPage.tsx          # Agent fleet monitor
│   │   ├── DashboardPage.tsx       # System overview
│   │   ├── AnalyticsPage.tsx       # Usage analytics
│   │   └── SettingsPage.tsx        # Configuration UI
│   │
│   ├── services/
│   │   ├── chatService.ts          # SSE client + onAgentStatus + onCitations callbacks
│   │   ├── agentService.ts         # Agent fleet API calls
│   │   ├── uploadService.ts        # File upload API calls
│   │   ├── researchService.ts      # Research API calls
│   │   └── api.ts                  # Axios base client
│   │
│   ├── store/                      # Zustand state stores
│   │   ├── chatStore.ts            # Messages, streaming, activeAgent, agentPipeline
│   │   ├── uploadStore.ts          # Image attachments, base64 encoding, validation
│   │   ├── agentStore.ts           # Agent fleet status
│   │   ├── sessionStore.ts         # Chat sessions
│   │   └── uiStore.ts              # Toast notifications, UI state
│   │
│   ├── components/
│   │   ├── shared/                 # GlassPanel, LuxuryLabel, LoadingPulse, etc.
│   │   ├── sidebar/                # Navigation sidebar
│   │   ├── navbar/                 # Top navigation
│   │   └── dashboard/              # Dashboard widgets
│   │
│   ├── layouts/
│   │   └── MainLayout.tsx          # App shell with sidebar + content area
│   │
│   └── utils/
│       └── constants.ts            # API base URL, route constants
│
├── index.html                      # Vite HTML entry
├── vite.config.ts                  # Vite config (React + TailwindCSS, port 3000)
├── tsconfig.json                   # TypeScript config
└── package.json                    # Node dependencies
```

---

## ✅ Prerequisites

- **Node.js** 18+ and **npm** 9+
- **Python** 3.11+
- A **Supabase** project (free tier works)
- One of:
  - **AWS credentials** with Bedrock access (Kimi K2.5 model enabled in `eu-north-1`)
  - **Google Gemini API key** (used as fallback — required for embeddings)
- *(Optional)* **Tavily API key** for web research features

---

## 🚀 Installation

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd aetheris-os
```

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Set up Python virtual environment

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

---

## 🔐 Environment Variables

### Backend — `backend/.env`

```env
# ── Primary AI: AWS Bedrock ───────────────────────────────
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=eu-north-1
MODEL_ID=moonshotai.kimi-k2.5

# ── Fallback AI + Embeddings: Google Gemini ───────────────
GEMINI_API_KEY=your_gemini_api_key

# ── Web Research (optional) ───────────────────────────────
TAVILY_API_KEY=your_tavily_api_key

# ── Vector Database: Supabase ─────────────────────────────
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_service_role_key

# ── Server ────────────────────────────────────────────────
HOST=0.0.0.0
PORT=8000
CORS_ORIGINS=http://localhost:3000

# ── RAG Tuning ────────────────────────────────────────────
CHUNK_SIZE=800
CHUNK_OVERLAP=150
TOP_K=10
SIMILARITY_THRESHOLD=0.7
```

### Frontend — `.env.local` (project root)

```env
VITE_API_URL=http://localhost:8000
```

> **Note:** `GEMINI_API_KEY` is **required** even if you use Bedrock as the primary LLM — it is used for generating document embeddings in the RAG pipeline.

---

## 🗄 Database Setup

Run the migration SQL in your **Supabase SQL Editor**:

```bash
# Copy the contents of backend/migrations/001_init.sql
# and paste into: Supabase Dashboard → SQL Editor → New Query → Run
```

This creates:

| Table | Purpose |
|---|---|
| `documents` | Uploaded file metadata (filename, type, status) |
| `chunks` | Document text chunks + `vector(768)` embeddings |
| `sessions` | Chat session records |
| `messages` | Per-session message history with citations |
| `research_history` | Deep research query logs |
| `memory` | Semantic memory store |

And the `match_chunks()` PostgreSQL function for cosine similarity search using HNSW indexing.

---

## ▶ Running the Application

### Start the Backend

```bash
cd backend
# Activate virtual env first
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

On startup you'll see:
```
============================================================
  Aetheris OS Backend — Neural Core Online
============================================================
  Bedrock Ready  : True
  Bedrock Model  : moonshotai.kimi-k2.5
  Bedrock Region : eu-north-1
  Gemini Ready   : True
  Tavily Key Set : True
  Supabase URL   : set
  CORS Origins   : ['http://localhost:3000']
============================================================
```

### Start the Frontend

```bash
# From the project root
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/chat` | Multimodal chat with SSE streaming |
| `POST` | `/api/research` | Deep research with SSE progress |
| `POST` | `/api/research/quick` | Non-streaming quick research |
| `POST` | `/api/upload` | Upload file → background RAG ingestion |
| `GET` | `/api/documents` | List uploaded documents |
| `DELETE` | `/api/documents/{id}` | Delete document + its chunks |
| `GET` | `/api/agents` | Agent fleet status |
| `GET` | `/api/sessions` | List chat sessions |
| `POST` | `/api/sessions` | Create new session |
| `GET` | `/api/sessions/{id}/messages` | Get session messages |
| `POST` | `/api/vision` | Image analysis (base64) |
| `POST` | `/api/code-analysis` | Code review / debug / optimize |
| `POST` | `/api/dataset-analysis` | CSV/JSON/XLSX analysis |

Full interactive docs: **http://localhost:8000/docs**

---

## 🖥 Frontend Pages

| Route | Page | Description |
|---|---|---|
| `/` | Dashboard | System overview, agent status, quick stats |
| `/chat` | AI Chat | Multimodal chat with live agent badge |
| `/research` | Research | Deep autonomous research interface |
| `/upload` | Uploads | Drag-and-drop document ingestion |
| `/agents` | Agent Fleet | Monitor all agents in real time |
| `/analytics` | Analytics | Usage and performance metrics |
| `/settings` | Settings | API keys, preferences |

---

## 🧠 LLM Provider Strategy

All AI inference routes through `backend/services/llm_service.py`:

```
┌─────────────────────────────────────────┐
│              generate_stream()          │
│                                         │
│  1. AWS Bedrock ConverseStream          │
│     moonshotai.kimi-k2.5               │
│     Binary event-stream protocol        │
│     (AWS SigV4 signed, no botocore)    │
│                 │                       │
│     Success? ───┘  yield tokens         │
│     Failure? ──▶                        │
│                                         │
│  2. Gemini SSE Fallback                 │
│     gemini-3-flash-preview              │
│     gemini-2.5-flash                   │
│     gemini-3.1-flash-lite              │
│     (tries each in order)              │
└─────────────────────────────────────────┘
```

**Embedding fallback chain** (`rag/embeddings.py`):
```
1. v1/models/text-embedding-004        ← primary (moved to v1 API)
2. v1beta/models/gemini-embedding-exp-03-07
3. v1beta/models/embedding-001         ← legacy fallback
```

---

## 📚 RAG Pipeline

When a file is uploaded:

```
POST /api/upload
    │
    ▼
Save file to disk
    │
    ▼
Insert document metadata → Supabase (status: "processing")
    │
    ▼
Background Task: _ingest_document()
    │
    ├── 1. file_processor.process_file()
    │       Parse text (PDF, DOCX, TXT, code, CSV, JSON…)
    │       Split into overlapping chunks (800 chars, 150 overlap)
    │
    ├── 2. embeddings.embed_batch()
    │       Embed all chunks in parallel (Gemini text-embedding-004)
    │
    ├── 3. vector_store.upsert_chunks()
    │       Store chunk content + vector(768) in Supabase
    │       HNSW index for fast cosine similarity search
    │
    └── 4. Update document status → "parsed"
```

When a user asks a question, RAG retrieval:

```
Query → embed_text() → match_chunks() RPC → top-K chunks
    → format_context() → inject into LLM prompt → answer
```

> **Resilience:** If embedding fails (API down, empty store), retrieval returns `[]` and the LLM responds from general knowledge — chat never crashes.

---

## 📡 SSE Streaming Protocol

The `/api/chat` endpoint streams the following event types:

```jsonc
// Session assignment (first event)
{ "type": "session",      "session_id": "uuid" }

// Orchestrator routing metadata (live agent badge in UI)
{ "type": "agent_status", "agent": "deep_research", "pipeline": ["web_research","rag_knowledge","deep_research"], "input_type": "research_query" }

// Streaming text token
{ "type": "token",        "content": "The " }

// Citations from research/RAG (displayed below message)
{ "type": "citations",    "citations": [...], "sources": [...] }

// Deep research metadata
{ "type": "agent_info",   "agent": "deep_research", "confidence": 0.87, "sub_queries": [...] }

// Error
{ "type": "error",        "message": "..." }

// Stream complete
data: [DONE]
```

---

## 🧩 Key Design Decisions

- **No botocore dependency** — AWS SigV4 signing is implemented in pure Python stdlib to keep the Docker image lean and startup instant.
- **Graceful degradation everywhere** — Every AI call has a fallback; every retrieval failure returns empty instead of raising.
- **Orchestrator as gateway** — `route_request()` is the single entry point for all chat traffic; adding a new agent only requires adding a branch here.
- **Session memory is in-memory** — Fast, zero-dependency, 50-message window. For production, swap `session_memory.py` with a Redis or Supabase-backed store.
- **Background ingestion** — File uploads respond instantly; parsing + embedding runs as a FastAPI `BackgroundTask` to avoid HTTP timeouts on large files.

---

<div align="center">
  <sub>Built with ⚡ by the Aetheris team · Powered by AWS Bedrock, Google Gemini & Supabase</sub>
</div>

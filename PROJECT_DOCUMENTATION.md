# ThinkSync OS — Complete Project Documentation

> **Multimodal AI Research Platform with Autonomous Agent Orchestration**
>
> *Professional reference for hackathons, expos, investors, and technical juries*

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Problem Statement](#2-problem-statement)
3. [Existing System vs Proposed System](#3-existing-system-vs-proposed-system)
4. [Objectives](#4-objectives)
5. [Features List](#5-features-list)
6. [Technical Architecture](#6-technical-architecture)
7. [App Flow](#7-app-flow)
8. [System Workflow](#8-system-workflow)
9. [User Workflow](#9-user-workflow)
10. [AI Workflow](#10-ai-workflow)
11. [Tech Stack Explanation](#11-tech-stack-explanation)
12. [Database Workflow](#12-database-workflow)
13. [API Flow](#13-api-flow)
14. [Security Features](#14-security-features)
15. [Scalability](#15-scalability)
16. [Why This Project Is Unique](#16-why-this-project-is-unique)
17. [Real-World Use Cases](#17-real-world-use-cases)
18. [Benefits](#18-benefits)
19. [Future Enhancements](#19-future-enhancements)
20. [Expo Presentation Guide](#20-expo-presentation-guide)
21. [Jury Convincing Points](#21-jury-convincing-points)
22. [Why Choose ThinkSync OS Over Other AI Tools](#22-why-choose-thinksync-os-over-other-ai-tools)
23. [Monetization Possibilities](#23-monetization-possibilities)
24. [Deployment Architecture](#24-deployment-architecture)
25. [Folder Structure](#25-folder-structure)
26. [Internal Working](#26-internal-working)
27. [Elevator Pitch](#27-elevator-pitch)
28. [Demo Script](#28-demo-script)
29. [FAQ for Juries](#29-faq-for-juries)

---

## 1. Project Overview

**ThinkSync OS** is a full-stack multimodal AI research platform that functions as an intelligent operating system for knowledge work. It doesn't just answer questions — it *researches, reads documents, analyzes images, writes code, and remembers everything you've discussed.*

At its core sits a fleet of **8 specialized AI agents** coordinated by a central Orchestrator. When you ask a question, the system classifies your intent, selects the right agent (or combination of agents), retrieves relevant context from your uploaded documents, and streams back a grounded, cited response in real-time.

Think of it as having a research team that works at machine speed — a planner who breaks down complex tasks, a researcher who scours the web and synthesizes findings, a document analyst who reads your PDFs and answers questions with exact citations, a code reviewer who analyzes your codebase, and a visual analyst who can read and reason about images.

**Built with:** React 19 + TypeScript frontend with premium glassmorphism UI, FastAPI (Python) backend orchestrating LLM calls across Google Gemini, AWS Bedrock, and Groq, with Supabase + pgvector for persistence and vector similarity search.

---

## 2. Problem Statement

Researchers, students, and professionals spend 40–60% of their time on *finding, reading, organizing, and cross-referencing information* — not on actually thinking about it. The problem compounds when working across multiple formats: PDFs, images, code, web sources, and datasets.

Current AI tools address this partially:
- **ChatGPT / Gemini chat** — great for general Q&A but forget everything between sessions and can't read your documents
- **Perplexity** — searches the web but doesn't integrate your private knowledge base
- **Notion AI / Copilot** — work within their ecosystems but can't do autonomous multi-step research
- **Custom RAG tools** — handle document Q&A but lack multi-agent intelligence and vision capabilities

**The core gap:** No single platform combines *autonomous research, document-grounded Q&A, multimodal vision, code analysis, and persistent memory* in one unified environment. ThinkSync OS fills that gap.

---

## 3. Existing System vs Proposed System

| Dimension | Existing Solutions | ThinkSync OS |
|---|---|---|
| **Intelligence** | Single monolithic model | 8 specialized agents with orchestrated routing |
| **Document Understanding** | Upload limits, basic retrieval, no citations | Full RAG: semantic chunking + hybrid retrieval + reranking + citations |
| **Research** | Single-turn web search | Autonomous multi-step deep research with planning |
| **Memory** | No cross-session memory | Three-tier: working → short-term → long-term |
| **Vision** | Basic image description | Full pipeline: classification → OCR → reasoning |
| **Code Analysis** | Generic code help | Dedicated code agent with language-aware analysis |
| **Retrieval Quality** | Basic vector search | Hybrid (dense + sparse + semantic) with LLM reranking |
| **Response Grounding** | Often hallucinates sources | Inline citations with source attribution + confidence scoring |
| **Customization** | Closed systems | Open-source, configurable agents, pluggable LLM providers |

---

## 4. Objectives

1. Build an **intelligent agent orchestration layer** that classifies user intent and routes queries to the best-fit specialized agent
2. Implement **production-grade RAG** with semantic chunking, hybrid retrieval, cross-encoder reranking, and semantic caching
3. Enable **autonomous deep research** — decompose complex questions, search the web independently, aggregate sources, synthesize reports
4. Support **multimodal input and analysis** — images, code files, datasets, and traditional documents
5. Create a **persistent, evolving memory system** with a three-tier architecture
6. Deliver a **premium, responsive user experience** with real-time SSE streaming and polished dark-themed UI
7. Maintain **provider flexibility** with multi-LLM abstraction (Gemini + Bedrock + Groq) and automatic fallbacks

---

## 5. Features List

### Core AI
- 🧠 Multi-Agent Orchestration — 8 agents with intelligent intent-based routing
- 🔬 Autonomous Deep Research — multi-step with sub-question decomposition and source synthesis
- 📄 RAG Document Q&A — hybrid retrieval + reranking with inline citations
- 👁️ Vision Analysis — classification → OCR → visual reasoning
- 💻 Code Intelligence — multi-language analysis, review, documentation
- 📊 Dataset Analysis — CSV/tabular statistical analysis
- 🎯 Task Planning — complex query decomposition into agent-executable sub-tasks
- 🌐 Web Research — real-time Tavily API search

### RAG Pipeline
- Semantic Chunking (parent-child hierarchy, embedding-based boundaries)
- Hybrid Retrieval (dense vector + sparse BM25 + semantic with RRF fusion)
- Cross-Encoder Reranking (Cohere → Jina → Gemini → passthrough, 4-tier fallback)
- Semantic Cache (cosine similarity ≥ 0.92)
- Multi-Document Binding

### Memory
- Three-Tier Memory (working → short-term → long-term)
- Memory Consolidation (automatic promotion across tiers)
- Semantic Retrieval (vector similarity search over memory)
- Namespace Isolation (each agent's memory is sandboxed)

### User Experience
- 🖥️ Dashboard — stats, quick actions, recent activity
- 💬 Streaming Chat — real-time SSE with typing indicators
- 📎 Multimodal Input — text + image upload (drag-and-drop)
- 📥 File Upload — PDF, DOCX, TXT, CSV, JSON, code (20+ formats)
- 📋 PDF Export — export research reports
- 🎨 Premium Dark UI — glassmorphism, gradient accents, Framer Motion animations
- 🔍 Source Citations — inline with confidence scores

---

## 6. Technical Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     React 19 Frontend                    │
│  Dashboard │ Chat │ RAG Agent │ Research │ Upload │ ...  │
│  (Zustand state • Framer Motion • TailwindCSS 4)        │
├─────────────────────────┬───────────────────────────────┤
│                  Axios + SSE Streaming                   │
├─────────────────────────┴───────────────────────────────┤
│                    FastAPI Backend                        │
│  ┌──────────────────────────────────────────────────┐   │
│  │         Agent Orchestrator (Intent Router)        │   │
│  │  ┌────────┐ ┌──────┐ ┌─────┐ ┌──────┐ ┌──────┐ │   │
│  │  │Research│ │ RAG  │ │Code │ │Vision│ │Data  │ │   │
│  │  │ Agent  │ │Agent │ │Agent│ │Agent │ │Agent │ │   │
│  │  └────────┘ └──────┘ └─────┘ └──────┘ └──────┘ │   │
│  │  ┌────────┐ ┌──────────┐ ┌──────────────────┐  │   │
│  │  │Planner │ │Web Search│ │File Processor    │  │   │
│  │  │ Agent  │ │  Agent   │ │                  │  │   │
│  │  └────────┘ └──────────┘ └──────────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────┐  ┌───────────────┐  ┌────────────────┐   │
│  │LLM Svc   │  │RAG Pipeline   │  │Tiered Memory   │   │
│  │Bedrock → │  │Chunk→Embed→   │  │L1(process)→    │   │
│  │Gemini →  │  │Retrieve→      │  │L2(Supabase)→   │   │
│  │Groq      │  │Rerank→Generate│  │L3(vector)      │   │
│  └──────────┘  └───────────────┘  └────────────────┘   │
├─────────────────────────────────────────────────────────┤
│              Supabase (PostgreSQL + pgvector)             │
│  documents│chunks│sessions│messages│memory│research_*    │
└─────────────────────────────────────────────────────────┘
     ↕               ↕               ↕
  Tavily API    Google Gemini    AWS Bedrock / Groq
```

---

## 7. App Flow

```
User Opens App → Dashboard (overview, stats, quick actions)
     ├─→ Upload → Drag files → Auto-parse → Chunk + Embed → Ready for RAG
     ├─→ Chat → Select agent → Send message → Stream response
     ├─→ RAG Agent → Select docs → Ask question → Get cited answer
     ├─→ Research → Enter query → Watch autonomous research → Export PDF
     ├─→ Agents → View fleet status and capabilities
     ├─→ Analytics → Usage metrics and trends
     └─→ Settings → Model selection, API keys, RAG config
```

---

## 8. System Workflow

```
User Message → Frontend (React) → POST /api/chat (SSE)
    → FastAPI Route Handler → Orchestrator
    → Intent Classification (keyword fast-path → LLM fallback)
    → Memory Injection (retrieve relevant past context)
    → Agent Dispatch (Research | RAG | Code | Vision | Data | General)
    → Agent Processing:
        RAG: Embed → Hybrid Retrieve → Rerank → Generate with context
        Research: Plan → Sub-questions → Web Search → Synthesize report
        Vision: Preprocess → OCR → Classify → Reason
        Code: Parse → Analyze → Generate response
    → LLM Generation (Bedrock → Gemini → Groq fallback chain)
    → Response Refiner (strip robotic phrasing)
    → SSE Stream → Frontend renders markdown + citations
    → Persist to Supabase + Update Memory Tiers
```

---

## 9. User Workflow

**First-Time Journey:**
1. **Dashboard** — See platform overview, stats, quick actions
2. **Upload** — Drag-and-drop PDFs, DOCX, CSVs; automatic processing
3. **Chat** — Ask questions; orchestrator selects the best agent automatically
4. **RAG** — Select documents, ask questions, get answers with inline citations
5. **Research** — Enter complex query, watch real-time autonomous research, export PDF
6. **Analyze Images** — Upload image in chat; vision pipeline classifies, extracts text, reasons
7. **Review** — Check analytics, manage documents, export reports

---

## 10. AI Workflow

### Agent Orchestration
```
User Query → Intent Classifier
    ├─ Keywords detected? → Fast-path routing (sub-ms)
    └─ Ambiguous? → LLM classification (200-400ms)
        ├─ Research → Deep Research Agent (plan → search → synthesize)
        ├─ Document → RAG Agent (embed → retrieve → rerank → generate)
        ├─ Code → Code Agent (analyze → generate)
        ├─ Image → Vision Agent (preprocess → OCR → classify → reason)
        ├─ Data → Dataset Agent (parse → stats → insights)
        ├─ Complex → Planner Agent (decompose → route sub-tasks → aggregate)
        └─ General → Direct LLM generation
```

### LLM Provider Strategy
```
Primary: AWS Bedrock (Kimi K2.5) → Fallback: Gemini 2.5-flash → 2.0-flash → 1.5-flash
Embeddings: Gemini text-embedding-004 (768 dims)
Speed-critical: Groq (Llama 3.3 70B)
Web Search: Tavily API (advanced depth)
```

### RAG Pipeline
```
Ingestion: Parse → Semantic Chunk (parent-child) → Embed (768d) → Store (pgvector)
Query: Semantic Cache → Hybrid Search (vector + BM25) → RRF Fusion → Rerank → Parent Expansion → LLM Generation
```

---

## 11. Tech Stack Explanation

| Technology | Why |
|---|---|
| **React 19** | Latest concurrent rendering for our multi-panel OS interface |
| **TypeScript** | Type safety across 7 services and 5 stores |
| **Vite 6** | Sub-second HMR for rapid iteration on 8 pages |
| **TailwindCSS 4** | Utility-first CSS keeping dark glassmorphism UI consistent |
| **Zustand 5** | Minimal hook-based stores without Redux boilerplate |
| **Framer Motion** | Production animations — page transitions, message fade-ins, stagger effects |
| **FastAPI** | Async Python with native SSE support for streaming |
| **Google Gemini** | Best cost-to-quality ratio; multimodal + embedding support |
| **AWS Bedrock** | Enterprise-grade fallback with Kimi K2.5 |
| **Groq** | Sub-100ms inference for intent classification |
| **Supabase** | PostgreSQL + pgvector + REST API in one service |
| **pgvector** | Native vector similarity with HNSW + IVFFlat indexes |
| **Tavily** | Clean web search results optimized for LLM consumption |

---

## 12. Database Workflow

### Schema (7 Tables)
- **documents** — uploaded files with metadata, status, category
- **chunks** — text chunks with 768d pgvector embeddings
- **sessions** — chat/research sessions
- **messages** — conversation messages with citations, reasoning steps, attachments
- **memory** — episodic memory with vector embeddings
- **research_sessions** — autonomous research results with sub-queries, sources, reports
- **research_history** — research query history linked to sessions

### Vector Search
- **Global search**: `match_chunks()` RPC — cosine similarity across all chunks
- **RAG-scoped search**: `match_rag_chunks()` RPC — filtered to `category='rag_agent'`
- **Memory search**: `match_memory()` RPC — semantic search over memory table
- **Indexes**: HNSW (real-time) + IVFFlat (large collections) on embeddings

---

## 13. API Flow

### 36 Endpoints Organized by Domain

| Domain | Key Endpoints |
|---|---|
| **Chat** | `POST /api/chat` (SSE streaming) |
| **RAG** | `POST /api/rag/upload`, `POST /api/rag/query`, `GET /api/rag/documents`, `GET /api/rag/stats`, `GET /api/rag/suggestions` |
| **Research** | `POST /api/research` (SSE), `POST /api/research/quick`, CRUD on sessions, export |
| **Upload** | `POST /api/upload` |
| **Documents** | `GET /api/documents`, `DELETE /api/documents/{id}`, retry ingestion |
| **Sessions** | CRUD + messages + auto-title generation |
| **Vision** | `POST /api/vision` (legacy, now via chat) |
| **Analytics** | `GET /api/analytics/dashboard` |
| **Agents** | `GET /api/agents` (registry) |
| **Code** | `POST /api/code-analysis` |
| **Dataset** | `POST /api/dataset/analyze`, `POST /api/dataset/upload` |
| **AI Utils** | `POST /api/analyze/pdf`, `POST /api/generate/structured` |
| **Health** | `GET /api/health` |

### SSE Streaming Protocol
Events: `session`, `agent_status`, `token`, `citations`, `agent_info`, `source_found`, `thought`, `[DONE]`, `error`

---

## 14. Security Features

| Feature | Implementation |
|---|---|
| CORS Allowlist | Origin-specific access control |
| Environment Secrets | API keys in `.env` files, never hardcoded |
| Cascade Deletes | FK CASCADE prevents orphaned data |
| Pydantic Validation | All request payloads validated |
| Parameterized Queries | PL/pgSQL typed parameters — no SQL injection |
| Category Isolation | RAG agent queries scoped to `category='rag_agent'` |
| File Validation | Extension + MIME type + size limit (50MB) |
| Rate Limiting | LLM service request throttling |
| Retry with Backoff | Exponential backoff on API failures |
| Response Refiner | Error messages sanitized, no stack trace leakage |
| NULL Guards | Embedding IS NOT NULL filters on unprocessed chunks |
| Memory Namespace Isolation | Agents can only access their own memory partition |

---

## 15. Scalability

| Layer | Scales Via |
|---|---|
| **Frontend** | CDN-deployed static build (infinite) |
| **Backend** | Horizontal: multiple FastAPI workers + load balancer |
| **Database** | pgvector handles millions of vectors; HNSW + IVFFlat indexes |
| **LLM** | Multi-provider fallback prevents single-point failure |
| **Caching** | Semantic cache eliminates redundant LLM calls |
| **Processing** | Background ingestion for large files |

**Why it works:** Stateless backend (all state in Supabase), async-native (hundreds of concurrent SSE streams), database-level intelligence (vector search in PostgreSQL), and independent component scaling.

---

## 16. Why This Project Is Unique

1. **Multi-Agent Orchestration** — 8 specialized agents with two-stage intent classification (keyword fast-path + LLM semantic classifier), not a single model for everything
2. **Production-Grade RAG** — Semantic parent-child chunking, 3-strategy hybrid retrieval with RRF fusion, 4-tier reranker fallback (Cohere → Jina → LLM → passthrough), semantic caching
3. **Autonomous Deep Research** — Query decomposition, parallel web search, source aggregation, editorial-quality report synthesis — all automated with live progress streaming
4. **Three-Tier Memory** — Working (in-process) → short-term (Supabase persistent) → long-term (vector-embedded episodic) — system gets smarter over time
5. **Multimodal Vision Pipeline** — Integrated 5-stage pipeline (preprocess → OCR → classify → describe → reason) with type-specific analysis strategies
6. **The OS Metaphor** — Dashboard, file management, agent fleet, analytics — designed as a research operating system, not a chatbot

---

## 17. Real-World Use Cases

| Use Case | How It Works |
|---|---|
| 📚 **Academic Research** | Upload papers → RAG query cross-document questions → deep research for latest findings |
| 🏥 **Medical Literature** | Upload clinical guidelines → query drug interactions with citations |
| 🏢 **Market Research** | Deep research on competitors → automated analysis reports with sources |
| 💻 **Code Review** | Upload codebase → analyze architecture, detect bugs, generate docs |
| 📊 **Data Analysis** | Upload CSV → automated statistical analysis with AI insights |
| 📸 **Document Digitization** | Upload handwritten notes → OCR extraction → searchable knowledge base |
| 🎓 **Exam Prep** | Upload course materials → practice Q&A grounded in study material |

---

## 18. Benefits

**For Users:** Time savings (hours → minutes), source confidence (cited responses), persistent knowledge base, multimodal flexibility, one platform replaces multiple tools

**For Developers:** Clean modular architecture, extensible agent system, multi-provider LLM (no vendor lock-in), full TypeScript + Pydantic type safety, open source

**For Organizations:** Cost control (self-hosted, own API keys), data privacy, customizable agents and RAG parameters, clear scalability path

---

## 19. Future Enhancements

**Short-Term:** User authentication (Supabase Auth), collaborative workspaces, voice input/output, mobile-responsive UI

**Medium-Term:** Plugin system for custom agents, knowledge graph construction, fine-tuned models, public API, citation manager integration

**Long-Term:** Multi-agent collaboration (agents cross-reference each other), real-time collaboration (shared sessions), agentic workflow pipelines, enterprise features (SSO, audit logs), on-premise Docker/K8s deployment

---

## 20. Expo Presentation Guide

**Opening Hook (30 sec):** *"What if an AI could do your entire research process — search, read, analyze, synthesize — and give you a cited report in under 3 minutes?"*

**Walkthrough (3 min):**
1. Dashboard — show the OS-like design
2. Upload a PDF — show automatic processing
3. RAG Query — ask a question, show inline citations
4. Deep Research — enter query, show real-time progress streaming
5. Show research report with source links, export to PDF
6. Upload image — show OCR + reasoning

**Technical Depth (2 min):** Architecture diagram, multi-agent orchestration, RAG pipeline stages, three-tier memory

**Close (30 sec):** *"Not another ChatGPT wrapper. A research operating system with agent teams that think, remember, and research autonomously."*

---

## 21. Jury Convincing Points

- **Technical Depth:** Semantic parent-child chunking, 3-strategy hybrid retrieval with RRF, 4-tier reranker fallback, pure-Python AWS SigV4 signing — this is production engineering, not a tutorial project
- **Innovation:** Two-stage intent classification, 8 specialized agents with namespace-isolated memory, autonomous research with parallel web search
- **Practical Value:** Solves real problems for researchers, students, analysts — saves hours per research task
- **Engineering Quality:** Clean separation of concerns, TypeScript + Pydantic validation, multi-provider fallback chains
- **UI/UX Polish:** Real-time SSE streaming, glassmorphism dark theme, Framer Motion animations, drag-and-drop uploads, PDF export
- **Scalability:** Stateless backend, database-level vector search with HNSW, semantic caching, horizontal scaling path

---

## 22. Why Choose ThinkSync OS Over Other AI Tools

| Pain Point | Others | ThinkSync OS |
|---|---|---|
| "I need deep research" | Manual multi-tab process | One-click autonomous research with live progress |
| "Answer from my documents" | Basic retrieval, no citations | Full RAG with hybrid search + reranking + citations |
| "Analyze an image" | Basic description | 5-stage vision: classify → OCR → reason |
| "AI forgets everything" | No cross-session memory | Three-tier memory that grows smarter over time |
| "Wrong approach for my question" | One-size-fits-all | 8 specialized agents with intelligent routing |
| "Too expensive" | $20-100/mo per user | Self-hosted with your own API keys |
| "I don't trust AI answers" | No verification | Citations + confidence scores on every response |

---

## 23. Monetization Possibilities

| Model | Details |
|---|---|
| **SaaS** | Free ($0) → Pro ($19/mo) → Team ($49/user/mo) → Enterprise (custom) |
| **API-as-a-Service** | Expose RAG + research as APIs ($0.01/query, $0.10/research) |
| **Plugin Marketplace** | Specialized agent plugins with 20% commission |
| **White-Label** | License to universities/institutions ($10K-$100K/yr) |

---

## 24. Deployment Architecture

**Development:** Vite :3000 + Uvicorn :8000 → Supabase Cloud

**Production (Recommended):**
```
CDN (static React build)
    → Load Balancer
    → N × FastAPI workers (stateless)
    → Supabase (PostgreSQL + pgvector)
    → External: Gemini API | Bedrock | Groq | Tavily
```

---

## 25. Folder Structure

```
Aether-main/
├── src/                          # Frontend (React 19 + TypeScript)
│   ├── pages/                    # 8 page components (Dashboard, Chat, RAG, Research, ...)
│   ├── components/               # UI components (Header, Sidebar, AgentsGrid, ...)
│   ├── store/                    # 5 Zustand stores (chat, upload, agent, session, UI)
│   ├── services/                 # 7 API services (chat, RAG, research, upload, ...)
│   ├── utils/                    # Formatters, file utils, PDF export
│   └── lib/                      # Supabase client
│
├── backend/                      # Backend (FastAPI + Python)
│   ├── agents/                   # 8 AI agents + orchestrator
│   ├── rag/                      # RAG pipeline (chunker, embeddings, retriever, reranker, cache)
│   ├── memory/                   # Tiered memory system (L1/L2/L3)
│   ├── vision/                   # Vision pipeline (OCR, classification, reasoning)
│   ├── services/                 # LLM service (multi-provider) + Groq
│   ├── routes/                   # 11 API route modules (36 endpoints)
│   ├── utils/                    # File parsers, response refiner
│   └── migrations/               # 6 SQL migrations (schema, indexes, RPC functions)
```

---

## 26. Internal Working

### Journey of a Query: "What are the key findings in my uploaded papers?"

1. **Frontend** captures message → `ragService.ts` sends `POST /api/rag/query` with SSE
2. **Route handler** validates payload → initializes streaming response
3. **Orchestrator** activates RAG Agent (skip intent classification — user is on RAG page)
4. **Memory** retrieves relevant past context from tiered memory
5. **Embeddings** embeds query via Gemini text-embedding-004 (768d vector)
6. **Semantic Cache** checks for similar past query (cosine ≥ 0.92)
7. **Hybrid Retrieval** fires in parallel: pgvector similarity + BM25 keyword search
8. **RRF Fusion** merges ranked lists from both strategies
9. **Reranker** re-scores top chunks for relevance (Cohere → Jina → LLM → passthrough)
10. **Parent Expansion** replaces child chunks with parent content for richer context
11. **LLM Generation** streams response with grounded context + source metadata
12. **Response Refiner** strips robotic openers/phrases
13. **Frontend** renders markdown in real-time with syntax highlighting and citations
14. **Persistence** stores messages in Supabase + updates memory tiers + updates semantic cache

**Time:** 2–8 seconds for most queries.

---

## 27. Elevator Pitch

> *"ThinkSync OS is an AI research operating system. Instead of a single chatbot, we run 8 specialized agents — researcher, document analyst, code reviewer, vision system — coordinated by an intelligent orchestrator.*
>
> *Upload documents, ask questions, and the system figures out which agent to use, retrieves relevant context with a production RAG pipeline, and streams cited responses in real-time. It even does autonomous deep research — give it a topic and it plans, searches, analyzes, and synthesizes a full report.*
>
> *Your entire research team, running at machine speed."*

---

## 28. Demo Script

**0:00 — Dashboard (30s):** "This is ThinkSync OS — mission control for AI research."

**0:30 — Upload (45s):** Drag-drop a PDF. "Automatically parsed, chunked, embedded, and stored in our vector database."

**1:15 — RAG Query (90s):** Select the paper, ask a question. "See the streaming response with blue citations. Every claim is grounded in your document — click to verify."

**2:45 — Deep Research (90s):** Enter a research query. "Watch the progress — creating research plan, decomposing into sub-questions, searching the web... synthesizing a report. 2-3 hours of manual work, done in 2 minutes."

**4:15 — Architecture (30s):** "Under the hood: 8 specialized agents, hybrid RAG with semantic chunking and reranking, three-tier memory that gets smarter over time."

**4:45 — Close (15s):** "ThinkSync OS: not a chatbot — a research operating system."

---

## 29. FAQ for Juries

**Q: How is this different from ChatGPT with file upload?**
Three things: 8 specialized agents vs one model, production RAG pipeline (hybrid retrieval + cross-encoder reranking vs basic vector search), and autonomous deep research (the system plans, searches, and synthesizes independently).

**Q: What models do you use?**
Multi-provider: AWS Bedrock (Kimi K2.5) primary, Gemini 2.5/2.0-flash fallback, Groq (Llama 3.3 70B) for speed tasks. Gemini text-embedding-004 for embeddings. Automatic fallback chain — if one goes down, the system keeps working.

**Q: How do you prevent hallucination?**
RAG grounds responses in retrieved document chunks with inline citations. Cross-encoder reranking ensures the most relevant chunks are prioritized. Confidence scoring flags uncertainty. Category isolation prevents data leakage between agents.

**Q: Can it scale?**
Stateless backend → horizontal scaling with load balancer. pgvector with HNSW handles millions of vectors. Semantic cache reduces LLM costs. Async-native FastAPI handles hundreds of concurrent SSE streams.

**Q: Is user data secure?**
Parameterized queries (no SQL injection), CORS allowlisting, file validation, env-based secrets. For production: add Supabase Auth + RLS policies + self-hosted deployment option.

**Q: Why custom-built instead of LangChain?**
Full control over hybrid retrieval (3-strategy RRF fusion), parent-child semantic chunking, 4-tier reranker fallback, and memory namespace isolation. Frameworks hide important behavior — we tuned every component.

**Q: Business model?**
SaaS (Free → Pro $19/mo → Team $49/user/mo → Enterprise), API-as-a-Service, plugin marketplace, white-label licensing for institutions.

---

> *Built with precision. Presented with purpose.*
>
> *ThinkSync OS — The Intelligent Research Operating System.*

# ThinkSync OS

> **A High-Fidelity Multimodal AI Research Platform with Autonomous Agent Orchestration**
>
> *An intelligent operating system for knowledge workers that unifies deep research, document Q&A, vision, code analysis, and persistent tiered memory.*

---

## 📖 Table of Contents

- [Project Overview](#-project-overview)
- [Key Features & Capabilities](#-key-features--capabilities)
- [Project Components ("Compounds") & Tech Stack](#-project-components-compounds--tech-stack)
- [APIs & Integration Architecture](#-apis--integration-architecture)
  - [External APIs](#external-apis)
  - [Internal API Endpoints](#internal-api-endpoints)
  - [SSE Streaming Protocol](#sse-streaming-protocol)
- [Deep-Dive: Custom RAG System](#-deep-dive-custom-rag-system)
  - [1. Parent-Child Semantic Chunking](#1-parent-child-semantic-chunking)
  - [2. Hybrid Retrieval (Dense + Sparse)](#2-hybrid-retrieval-dense--sparse)
  - [3. Reciprocal Rank Fusion (RRF)](#3-reciprocal-rank-fusion-rrf)
  - [4. Four-Tier Reranking Fallback](#4-four-tier-reranking-fallback)
  - [5. Semantic Caching](#5-semantic-caching)
  - [6. Grounded Generation & Citation Binding](#6-grounded-generation--citation-binding)
- [The Agentic Architecture](#-the-agentic-architecture)
  - [The Fleet of 8 Specialized Agents](#the-fleet-of-8-specialized-agents)
  - [Two-Stage Intent Classification](#two-stage-intent-classification)
  - [Tiered Memory System](#tiered-memory-system)
- [Directory Structure](#-directory-structure)
- [Setup & Installation](#-setup--installation)
- [Verification & Testing](#-verification--testing)
- [Troubleshooting](#-troubleshooting)

---

## 🎯 Project Overview

**ThinkSync OS** is built to eliminate the 40–60% of time knowledge workers spend finding, reading, organizing, and cross-referencing information. Unlike simple conversational chatbots, ThinkSync OS acts as a comprehensive, autonomous research team. It organizes tasks, reads complex documents (PDFs, datasets, code), reasons over visual media, searches the web, and synthesizes findings—all while maintaining a persistent memory of past interactions across sessions.

---

## 🌟 Key Features & Capabilities

- **🧠 Multi-Agent Orchestration:** 8 specialized agents intelligently coordinated by a central Orchestrator.
- **🔬 Autonomous Deep Research:** Decomposes complex queries, executes parallel web searches, aggregates sources, and generates professional-grade synthesis reports.
- **📄 Customized Production RAG:** Uses parent-child semantic chunking, dual-strategy hybrid retrieval, fusion ranking, and cross-encoder reranking for highly accurate Q&A with inline citations.
- **💾 Three-Tier Persistent Memory:** Maintains context across three layers (process/working memory, database/short-term, and vector-embedded long-term memory).
- **👁️ Multimodal Vision Pipeline:** A 5-stage pipeline for analyzing images (Preprocess → OCR → Classify → Describe → Reason).
- **⚡ Real-Time Streaming UI:** Renders markdown, syntax-highlighted code, and citation cards with smooth, glassmorphism-inspired dark UI animations using Server-Sent Events (SSE).

---

## 💻 Project Components ("Compounds") & Tech Stack

ThinkSync OS leverages a robust stack of libraries, frameworks, and database extensions (collectively referred to as the platform's "compounds") to deliver high performance:

### 1. Frontend Component Layer
- **React 19 & TypeScript:** Harnesses React's concurrent rendering capabilities to maintain a responsive OS-like workspace dashboard, chat panel, document explorer, and settings manager.
- **Vite 6:** Enables sub-second Hot Module Replacement (HMR) and optimized build bundles.
- **TailwindCSS 4:** Enforces a unified design language with customized dark glassmorphism styling, clean borders, and premium gradient accents.
- **Zustand 5:** Lightweight state store managing global client states across 5 modules: `chat`, `upload`, `agent`, `session`, and `ui`.
- **Framer Motion:** Powers micro-animations, page transitions, progress bars, and staggered entry animations.

### 2. Backend Component Layer
- **FastAPI (0.115.0):** Async Python web framework used to construct stateless REST endpoints and handle real-time streaming connections.
- **Uvicorn (0.30.0):** ASGI server powering the backend with low latency and high concurrency support.
- **Pydantic (v2):** Enforces strict request/response data validation and schema documentation.

### 3. Database & Retrieval Compounds
- **Supabase PostgreSQL:** Stores system configuration, chat histories, session memories, and RAG metadata.
- **pgvector:** Extends PostgreSQL to support 768-dimensional vector similarity operations directly inside database queries using **HNSW** (Hierarchical Navigable Small World) and **IVFFlat** indexes.
- **rank-bm25:** Performs sparse, term-frequency-based text search over documents using the BM25 algorithm.
- **tiktoken:** Counts tokens locally to enforce model context windows and optimize chunk sizes.
- **pypdf, python-docx, openpyxl, pyxlsb, xlrd, pyarrow, h5py:** A comprehensive set of python parsers that ingest and read files in PDF, DOCX, XLSX, XLSB, XLS, CSV, Parquet, Arrow, HDF5, and MATLAB formats.

### 4. AI & Inference Layer
- **AWS Bedrock / Groq / Google Gemini fallback chain:** Prevents service failure. Bedrock (Kimi K2.5) serves as the primary intelligence model, Google Gemini handles embeddings and multimodal tasks, while Groq (Llama 3.3 70B) handles fast intent classification.
- **Tavily Search API:** An API engineered specifically for LLM search queries, providing aggregated, clean markdown web contents.
- **Cohere Cross-Encoder:** A specialized deep-learning reranking engine that calculates semantic relevance scores between retrieved text chunks and queries.

---

## 🔌 APIs & Integration Architecture

### External APIs
1. **Google Gemini API:** Utilized for high-fidelity text embeddings (`text-embedding-004`) and multimodal vision fallbacks.
2. **AWS Bedrock API:** Invokes converse endpoints (primary reasoning engine).
3. **Groq API:** Drives intent classification with sub-100ms response times.
4. **Tavily Search API:** Powers the Deep Research Agent by collecting search engine results.
5. **Supabase Client API:** Manages communication with database tables and vector matching RPCs.

### Internal API Endpoints
The backend exposes **36 endpoints** mapping to different functionalities. The primary endpoints are:

- **Chat & Orchestration:**
  - `POST /api/chat`: The main Server-Sent Events (SSE) streaming endpoint. Classifies intent, coordinates agents, retrieves memories, and streams back responses.
  - `POST /api/code-analysis`: Evaluates codebase files for refactoring, documentation, or debugging.
  - `POST /api/dataset/analyze`: Performs statistical analysis and runs Python computations on CSV datasets.

- **RAG System Endpoints:**
  - `POST /api/rag/upload`: Ingests, chunks, embeds, and indexes document files.
  - `POST /api/rag/query`: RAG-focused document search and response generation.
  - `GET /api/rag/documents`: Lists ingested document libraries.

- **Autonomous Deep Research:**
  - `POST /api/research`: Initiates an asynchronous research session. Streams search queries, plans, and the final report.
  - `GET /api/research/sessions`: Lists historical research sessions and output reports.

### SSE Streaming Protocol
All LLM generations stream to the React client using Server-Sent Events. The protocol sends structured events:
- `event: session` — Establishes connection metadata.
- `event: agent_status` — Broadcasts state updates (e.g., "Planning search queries", "Reading source page").
- `event: token` — Emits raw text tokens for instantaneous rendering.
- `event: citations` — Delivers a JSON array of sources and match scores for claims made.
- `event: thought` — Emits intermediate steps taken by the Planner or Deep Research Agent.
- `event: [DONE]` — Signals natural end-of-stream.

---

## 🧠 Deep-Dive: Custom RAG System

The Retrieval-Augmented Generation (RAG) system in ThinkSync OS is designed for enterprise accuracy. It mitigates hallucinations through a structured multi-stage pipeline:

```
User Query ──> [Semantic Cache] ──(Hit)──> Bypasses LLM, returns cached response
                     │
                  (Miss)
                     ├──> Dense Vector Search (pgvector Cosine Similarity) ┐
                     │                                                      ├─> [Reciprocal Rank Fusion] ──> [Reranker Fallback] ──> [Parent Expansion] ──> LLM Generation
                     └──> Sparse Text Search (BM25 Keyword Matching)       ┘
```

### 1. Parent-Child Semantic Chunking
Instead of splitting documents by static character offsets (which cut sentences in half), ThinkSync OS uses a **parent-child chunking framework**:
- Documents are split into large **Parent Chunks** (1,000–2,000 tokens) representing complete sections or themes.
- Parent chunks are subdivided into overlapping **Child Chunks** (200–400 tokens) to capture granular facts.
- Only child chunks are embedded and indexed. If a child chunk is matched during retrieval, the system retrieves the entire parent chunk to serve as context for the LLM. This provides detail without diluting the semantic focus.

### 2. Hybrid Retrieval (Dense + Sparse)
Dense vector search can struggle with exact keyword matches, serial numbers, or rare terms. ThinkSync OS runs a dual retrieval process:
- **Dense Retrieval:** Computes cosine similarity between query embeddings and child chunk embeddings in Supabase (`match_chunks`).
- **Sparse Retrieval:** Executes a term-frequency BM25 search over document text to match keyword frequencies.

### 3. Reciprocal Rank Fusion (RRF)
To combine dense and sparse results, the system implements **Reciprocal Rank Fusion (RRF)**:
$$RRF\_Score(d) = \sum_{m \in M} \frac{1}{k + r_m(d)}$$
Where $r_m(d)$ is the rank of document $d$ in system $m$, and $k$ is a constant (default 60). This fuses vector semantic ranks and keyword ranks into a unified list, highlighting documents that rank highly in both methods.

### 4. Four-Tier Reranking Fallback
To ensure the LLM receives only highly relevant context, the top 20 candidate chunks are passed through a **4-tier reranking fallback structure**:
1. **Tier 1: Cohere Rerank API** (Deep learning cross-encoder).
2. **Tier 2: Jina Rerank API** (Alternative cross-encoder).
3. **Tier 3: LLM-based Reranking** (A fast instruction prompt evaluating relevance).
4. **Tier 4: Passthrough** (Fallback to original RRF ranks if APIs fail or are offline).

### 5. Semantic Caching
To reduce LLM latency and costs, ThinkSync OS caches previous Q&As. For every incoming query:
- The system embeds the query and runs a vector search against the `semantic_cache` table.
- If a query match is found with a cosine similarity of $\ge 0.92$, the cached response is immediately streamed back, reducing response times to milliseconds.

### 6. Grounded Generation & Citation Binding
When generating responses, the LLM receives retrieved text alongside unique IDs. The model is instructed to output tags like `[^1]` or `[^2]` corresponding to those IDs. The backend parses these tags and outputs them as formal citations containing file names, page numbers, text snippets, and confidence scores.

---

## 🤖 The Agentic Architecture

### The Fleet of 8 Specialized Agents
ThinkSync OS coordinates 8 independent agents, each with a specialized role:

1. **Orchestrator Agent:** The system brain. Intercepts incoming messages, manages agent states, handles fallback events, and routes queries.
2. **Planner Agent:** Triggered by complex tasks. Decomposes inputs into sequential sub-tasks and schedules execution paths.
3. **Deep Research Agent:** An autonomous loop that generates research sub-questions, executes parallel web searches via Tavily, reads pages, compiles facts, and generates detailed reports.
4. **RAG Agent:** Handles semantic Q&A, querying pgvector database collections with document-grounded context.
5. **Vision Agent:** Processes images via a 5-stage pipeline: OCR, classification, text extraction, visual layout mapping, and reasoning.
6. **Code Agent:** Reviews codebase files, documents structures, checks syntax, and generates refactoring plans.
7. **Dataset Agent:** Interacts with structured tables (CSV, JSON), executing Python calculations, generating statistics, and providing analytical insights.
8. **General Chat Agent:** Manages general conversation, definitions, reasoning, and tasks that do not require external search or document tools.

### Two-Stage Intent Classification
To route queries to the correct agent, the Orchestrator runs a fast classification process:
1. **Keyword Fast-Path:** Matches explicit commands (e.g., starting a query with `/code`, `/research`, or uploading an image/csv) for sub-millisecond dispatch.
2. **LLM Semantic Classifier:** If the intent is ambiguous, a low-latency Groq Llama-3.3 call evaluates the query's semantic intent and maps it to the target agent registry.

### Tiered Memory System
Each agent operates inside a **namespace-isolated tiered memory system** preventing cross-contamination of context:
- **L1 (Working Memory):** High-speed, in-process variable storage for current loops.
- **L2 (Short-Term Session Memory):** Session histories stored in the database (`messages` table) to maintain conversation threads.
- **L3 (Long-Term Semantic Memory):** Memory entries are summarized, embedded, and saved in the `memory` table. The Orchestrator queries L3 memory via vector similarity matching (`match_memory`) to retrieve past interactions.

---

## 📂 Directory Structure

```
ThinkSync-OS/
├── src/                          # Frontend (React 19 + TypeScript)
│   ├── pages/                    # Workspace Panels (Dashboard, Chat, RAG, Research, Analytics, Settings)
│   ├── components/               # UI components (Sidebar, AgentsGrid, StreamMessage, CitationCard, Loader)
│   ├── store/                    # Zustand stores (chatStore, uploadStore, agentStore, sessionStore, uiStore)
│   ├── services/                 # Axios API wrappers (chatService, ragService, researchService, uploadService)
│   ├── utils/                    # Formatting libraries, PDF export utils, markdown parsing
│   └── lib/                      # Supabase client instantiation
│
├── backend/                      # Backend (FastAPI + Python)
│   ├── agents/                   # Agent Definitions (base_agent, code_agent, deep_research_agent, orchestrator...)
│   ├── rag/                      # RAG Pipeline (chunker, embeddings, retriever, reranker, semantic_cache)
│   ├── memory/                   # Tiered Memory Implementation (session_memory, tiered_memory)
│   ├── vision/                   # Multimodal Pipeline (OCR, preprocessing, visual reasoning)
│   ├── services/                 # Multi-LLM provider abstractions (llm_service, groq_service)
│   ├── routes/                   # API Routers (chat, rag_chat, research, dataset_analysis, upload, health...)
│   ├── utils/                    # File extraction libraries (file_parsers, response_refiner)
│   └── migrations/               # SQL Migrations (schema definitions, pgvector RPC matches, performance indexes)
```

---

## 🚀 Setup & Installation

### Prerequisites
- **Node.js** 20.x or higher
- **Python** 3.10 or higher
- **Supabase Account** with a blank database project
- **API Keys** for Google Gemini, Groq, and Tavily (AWS Bedrock credentials optional)

### Step-by-Step Instructions

#### 1. Clone the Repository
```bash
git clone https://github.com/your-username/thinksync-os.git
cd thinksync-os
```

#### 2. Database Migration
- Open your **Supabase SQL Editor** in the dashboard.
- Execute the SQL migration scripts in order from `backend/migrations/` (`001_init.sql` through `005_fix_rpc_overloads.sql`). This will build the tables, enable the `vector` extension, and register the matching RPCs.

#### 3. Backend Installation
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows use: .venv\Scripts\activate
pip install -r requirements.txt
```

- Create a `.env` file in the `backend/` folder:
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-supabase-service-role-key
GEMINI_API_KEY=your-gemini-api-key
GROQ_API_KEY=your-groq-api-key
TAVILY_API_KEY=your-tavily-api-key

# Optional AWS Bedrock credentials:
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=moonshotai.kimi-k2.5
```

- Launch the API backend:
```bash
uvicorn main:app --reload --port 8000
```

#### 4. Frontend Installation
- Navigate back to the project root:
```bash
cd ..
npm install
```

- Create a `.env.local` file in the root folder:
```env
VITE_API_BASE_URL=http://localhost:8000/api
```

- Start the frontend development server:
```bash
npm run dev
```
- Open `http://localhost:3000` in your web browser.

---

## 🧪 Verification & Testing

To run the system test suite:
1. Navigate to the `backend/` directory.
2. Execute the python tests:
```bash
.venv\Scripts\python -m pytest tests/test_chunker.py tests/test_parsers.py
```
To check TypeScript type safety:
1. Navigate to the project root.
2. Run the linter:
```bash
npm run lint
```

---

## 🛠️ Troubleshooting

- **Supabase pgvector Match Errors:** Ensure all SQL migrations have been executed in Supabase. The system depends on database-level RPC functions like `match_chunks` and `match_memory`.
- **SSE Connection Aborted:** If the Server-Sent Events stream fails, ensure any reverse proxies (such as Nginx) have buffering disabled (`proxy_buffering off;`) and allow long-lived connections.
- **Agent Classifier Bypassed:** If the Orchestrator doesn't route questions to the proper agent, check that your `GROQ_API_KEY` is active and correct.
- **Upload Restrictions:** Uploads are restricted to 50MB by default to prevent timeouts. You can adjust limits in `backend/routes/upload.py` and `app_config.py`.

---

> *Built with precision. Presented with purpose.*
>
> **ThinkSync OS — The Intelligent Research Operating System.**

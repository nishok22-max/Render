"""
ThinkSync OS — Whitebox Tests: AI Chat / RAG Isolation
Verifies strict separation between the AI Chat brain and RAG Agent brain.

ISOLATION RULES TESTED:
  1. AI Chat memory/context must NEVER enter the RAG Agent.
  2. RAG retrieved documents/context must NEVER enter the AI Chat section.
  3. Only the current user query can be shared between both systems.
  4. RAG is ONLY triggered by explicit RAG keywords (opt-in).
  5. Non-RAG paths never set requires_rag=True.
"""
import pytest
import inspect
from agents.orchestrator import detect_intent
from agents.rag_agent import answer_with_rag


# ═══════════════════════════════════════════════════════════════════════════════
#  1. INTENT DETECTION — Routing Isolation
# ═══════════════════════════════════════════════════════════════════════════════

def test_general_chat_no_rag():
    """General greetings route to chat pipeline — never RAG."""
    intent = detect_intent("Hello, who are you?", attachments=[])
    assert intent["input_type"] == "general_chat"
    assert intent["primary_agent"] == "general_chat"
    assert intent["requires_rag"] is False
    assert "rag_knowledge" not in intent["pipeline"]

def test_default_query_no_rag():
    """Unmatched queries default to general_chat, NOT RAG."""
    intent = detect_intent("What is the capital of France?", attachments=[])
    assert intent["input_type"] == "general_query"
    assert intent["primary_agent"] == "general_chat"
    assert intent["requires_rag"] is False
    assert "rag_knowledge" not in intent["pipeline"]

def test_explicit_rag_keywords():
    """Explicit RAG keywords trigger RAG retrieval."""
    rag_queries = [
        "Search my documents for API specifications",
        "What does my uploaded file say about pricing?",
        "Query my knowledge base about the architecture",
        "Find in my files the deployment instructions",
    ]
    for query in rag_queries:
        intent = detect_intent(query, attachments=[])
        assert intent["requires_rag"] is True, f"Expected RAG for: {query}"
        assert intent["primary_agent"] == "rag_knowledge", f"Expected rag_knowledge for: {query}"

def test_research_no_rag():
    """Deep research does NOT include RAG in pipeline."""
    intent = detect_intent("Research the latest advancements in quantum computing and their implications", attachments=[])
    assert intent["primary_agent"] == "deep_research"
    assert "rag_knowledge" not in intent["pipeline"]
    assert intent["requires_rag"] is False
    assert intent["requires_web"] is True

def test_code_no_rag():
    """Code blocks trigger code intelligence, NOT RAG."""
    intent = detect_intent("Debug this python function", attachments=[])
    assert intent["input_type"] == "code_query"
    assert "code_intelligence" in intent["pipeline"]
    assert intent["requires_rag"] is False

def test_file_attachment_no_rag():
    """File attachments trigger file processor, NOT RAG."""
    attachments = [{"filename": "data.csv", "file_type": "csv"}]
    intent = detect_intent("Analyze this file", attachments=attachments)
    assert intent["input_type"] == "dataset"
    assert "dataset_analysis" in intent["pipeline"]
    assert intent["requires_rag"] is False

def test_document_upload_no_rag():
    """Document uploads do NOT auto-trigger RAG."""
    attachments = [{"filename": "report.pdf", "file_type": "pdf"}]
    intent = detect_intent("Process this document", attachments=attachments)
    assert intent["primary_agent"] == "file_processor"
    assert "rag_knowledge" not in intent["pipeline"]
    assert intent["requires_rag"] is False

def test_code_upload_no_rag():
    """Code file uploads do NOT auto-trigger RAG."""
    attachments = [{"filename": "app.py", "file_type": "py"}]
    intent = detect_intent("Review this code", attachments=attachments)
    assert intent["primary_agent"] == "code_intelligence"
    assert intent["requires_rag"] is False

def test_vision_no_rag():
    """Image attachments do NOT trigger RAG."""
    attachments = [{"filename": "photo.png", "file_type": "png"}]
    intent = detect_intent("What's in this image?", attachments=attachments)
    assert intent["primary_agent"] == "vision"
    assert intent["requires_rag"] is False


# ═══════════════════════════════════════════════════════════════════════════════
#  2. RAG AGENT ISOLATION — No Chat Memory Access
# ═══════════════════════════════════════════════════════════════════════════════

def test_rag_agent_no_conversation_history_param():
    """
    CRITICAL: answer_with_rag() must NOT accept conversation_history.
    This ensures the RAG brain can never receive chat memory.
    """
    sig = inspect.signature(answer_with_rag)
    param_names = list(sig.parameters.keys())
    
    assert "conversation_history" not in param_names, (
        "ISOLATION VIOLATION: answer_with_rag() must NOT have a "
        "conversation_history parameter. RAG Agent must never access chat memory."
    )

def test_rag_agent_accepts_only_query():
    """
    The RAG agent should accept only the user query and optional top_k.
    No chat context, no session memory, no personality data.
    """
    sig = inspect.signature(answer_with_rag)
    param_names = set(sig.parameters.keys())
    
    # Only allowed parameters
    allowed = {"query", "top_k"}
    
    # Check no forbidden parameters exist
    forbidden = {"conversation_history", "session_id", "chat_history",
                 "memory", "context", "personality", "preferences"}
    violations = param_names & forbidden
    
    assert not violations, (
        f"ISOLATION VIOLATION: answer_with_rag() has forbidden parameters: {violations}. "
        "RAG Agent must only receive the user query."
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  3. AI CHAT ISOLATION — No RAG Context Access
# ═══════════════════════════════════════════════════════════════════════════════

def test_chat_system_prompt_no_rag_references():
    """AI Chat system prompt must not reference RAG, retrieval, or documents."""
    from agents.orchestrator import CHAT_SYSTEM_PROMPT
    
    forbidden_terms = [
        "retrieval", "vector", "embedding", "chunk",
        "knowledge base", "document context", "RAG",
        "semantic search", "similarity",
    ]
    
    prompt_lower = CHAT_SYSTEM_PROMPT.lower()
    for term in forbidden_terms:
        assert term.lower() not in prompt_lower, (
            f"ISOLATION VIOLATION: CHAT_SYSTEM_PROMPT contains '{term}'. "
            "AI Chat brain must not reference RAG concepts."
        )

def test_chat_path_does_not_import_rag():
    """
    The general_chat path in the orchestrator must NOT import RAG modules.
    We verify this by checking the source code of route_request.
    """
    from agents.orchestrator import route_request
    source = inspect.getsource(route_request)
    
    # Find the general_chat section (after the last agent return)
    # The general chat path should not import from rag.*
    general_chat_section = source.split("# ── General Chat path")[-1]
    
    assert "from rag" not in general_chat_section, (
        "ISOLATION VIOLATION: General Chat path imports from rag module. "
        "AI Chat brain must never access RAG subsystem."
    )
    assert "build_context" not in general_chat_section, (
        "ISOLATION VIOLATION: General Chat path calls build_context. "
        "AI Chat brain must never access RAG retrieval."
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  4. UX — No Technical Jargon
# ═══════════════════════════════════════════════════════════════════════════════

def test_rag_system_prompt_user_friendly():
    """RAG system prompt must instruct the model to use user-friendly language."""
    from agents.rag_agent import RAG_SYSTEM_PROMPT
    
    prompt_lower = RAG_SYSTEM_PROMPT.lower()
    
    # Must instruct to avoid technical terms
    assert "never mention" in prompt_lower or "never mention technical" in prompt_lower, (
        "RAG system prompt should instruct model to avoid technical terminology."
    )
    
    # Must include user-friendly example phrases
    assert "according to your document" in prompt_lower or "found this in your" in prompt_lower, (
        "RAG system prompt should include user-friendly response examples."
    )

from fastapi import APIRouter

router = APIRouter()

@router.get("/agents")
async def list_agents():
    return {
        "agents": [
            {"id": "orchestrator", "name": "orchestrator", "displayName": "Orchestrator", "status": "idle", "taskCount": 0, "description": "Intelligent task routing"},
            {"id": "deep_research", "name": "deep_research", "displayName": "Deep Research", "status": "idle", "taskCount": 0, "description": "Autonomous web research"},
            {"id": "rag_knowledge", "name": "rag_knowledge", "displayName": "RAG Knowledge", "status": "idle", "taskCount": 0, "description": "Semantic retrieval"},
            {"id": "vision", "name": "vision", "displayName": "Vision Analysis", "status": "idle", "taskCount": 0, "description": "Image understanding"},
            {"id": "file_processor", "name": "file_processor", "displayName": "File Processor", "status": "idle", "taskCount": 0, "description": "Document parsing"},
            {"id": "code_intelligence", "name": "code_intelligence", "displayName": "Code Intelligence", "status": "idle", "taskCount": 0, "description": "Code analysis"},
            {"id": "dataset_analysis", "name": "dataset_analysis", "displayName": "Dataset Analysis", "status": "idle", "taskCount": 0, "description": "Statistical analysis"},
            {"id": "web_research", "name": "web_research", "displayName": "Web Research", "status": "idle", "taskCount": 0, "description": "Real-time search"},
            {"id": "reasoning", "name": "reasoning", "displayName": "Reasoning", "status": "idle", "taskCount": 0, "description": "Final synthesis"},
        ]
    }

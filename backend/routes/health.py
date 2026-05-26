from fastapi import APIRouter

router = APIRouter()

@router.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "thinksync-os",
        "version": "1.0.0",
        "agents": 9,
        "neural_core": "online"
    }

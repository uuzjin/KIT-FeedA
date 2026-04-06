from fastapi import APIRouter

from ..data import DASHBOARD

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
def get_summary():
    return DASHBOARD

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/analysis", tags=["analysis"])

_last_source = {"file_name": "week6_script.pdf"}


class AnalysisSourceUpdate(BaseModel):
    file_name: str


@router.post("/source")
def update_source(payload: AnalysisSourceUpdate):
    _last_source["file_name"] = payload.file_name
    return {"message": "분석 대상이 갱신되었습니다.", "file_name": payload.file_name}


@router.get("/report")
def get_analysis_report():
    return {
        "source_file": _last_source["file_name"],
        "logical_gaps": 2,
        "missing_terms": ["과적합", "드롭아웃"],
        "missing_prerequisites": ["선형대수 기본 개념"],
        "suggestions": [
            "어텐션 메커니즘에 대한 비유 추가",
            "정규화 설명 전에 사전 개념 슬라이드 추가",
        ],
    }

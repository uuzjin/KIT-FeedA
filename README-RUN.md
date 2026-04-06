# FeedA 실행 가이드

이 문서는 로컬 개발 환경에서 `backend`(FastAPI)와 `frontend`(Next.js)를 실행하는 방법을 설명합니다.

## 1) 사전 준비

- Python 3.10+ 권장
- Node.js 20+ 권장
- PowerShell 사용 기준

## 2) Backend 실행 (FastAPI)

프로젝트 루트(`KIT-FeedA`)에서 진행합니다.

```powershell
# 1. 가상환경 생성 (최초 1회)
python -m venv .venv

# 2. 가상환경 활성화
.\.venv\Scripts\Activate.ps1

# 3. 의존성 설치
pip install -r .\backend\requirements.txt

# 4. backend 폴더로 이동 후 서버 실행
cd .\backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

> 이미 `backend` 폴더에서 작업 중이면 아래처럼 바로 실행하면 됩니다.

```powershell
cd .\backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

정상 실행 확인:

- API 문서: <http://127.0.0.1:8000/docs>
- 헬스체크: <http://127.0.0.1:8000/health>

## 3) Frontend 실행 (Next.js)

새 PowerShell 터미널을 열고 아래를 실행합니다.

```powershell
cd .\frontend
npm install
npm run dev
```

프론트 의존성/설정 정상 여부를 빠르게 확인하려면 아래 명령도 권장합니다.

```powershell
cd .\frontend
npm run lint
npx tsc --noEmit
```

정상 실행 확인:

- 프론트엔드: <http://localhost:3000>

## 4) 개발 시 권장 실행 순서

1. 터미널 A에서 Backend 실행 (`127.0.0.1:8000`)
2. 터미널 B에서 Frontend 실행 (`localhost:3000`)
3. 브라우저에서 `http://localhost:3000` 접속

## 5) 자주 발생하는 문제

- **포트 충돌**
  - 8000 또는 3000 포트를 다른 프로세스가 사용 중이면 실행 포트를 변경하거나 기존 프로세스를 종료하세요.
- **PowerShell 실행 정책 오류**
  - 가상환경 활성화가 막히면 관리자 권한 PowerShell에서 정책 설정이 필요할 수 있습니다.
- **의존성 설치 오류**
  - Python/Node 버전이 너무 낮으면 설치 또는 실행 중 오류가 발생할 수 있습니다.

## 6) 종료 방법

- 실행 중인 각 터미널에서 `Ctrl + C`

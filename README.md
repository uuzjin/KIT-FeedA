<div>
    <h1>FeedA - 더 나은 학습 환경을 피워내다</h1>
    <p><a href='https://frontend-production-90dc.up.railway.app'>'FeedA(피다)'</a>는 Feedback과 Academy의 합성어로, 피드백을 통해 더 나은 학습 환경이 '피어난다'는 중의적 의미를 담고 있습니다.</p>
</div>

<br />

## 🗂 목차

1. [**웹 서비스 소개**](#1)
2. [**기술 스택**](#2)
3. [**로컬 실행 방법**](#3)
4. [**개발 기간**](#4)
5. [**Git Convention**](#5)

<br />

<div id="1"></div>

## 💡 웹 서비스 소개

### 문제 상황
1. 수업 자료 준비(예습, 복습 등)을 위해 발생하는 과도한 행정 업무 시간
2. 강사진과 학생 간의 배경 지식 차이
3. 강사진의 수업에 대한 객관적인 분석 불가

### 서비스 주요 기능
1. 강의 자료를 기반으로 AI의 예습, 복습 자료 생성
2. 복습 퀴즈를 통한 수업 이해도 측정 및 수업 내용의 질 판단
3. 예습, 복습 자료 생성에 대한 공지 자동 생성

### 기대 효과
1. 강사진의 예복습 자료 준비 시간 절약
2. 학생의 부족한 배경 지식 보완
3. 수업 후 학생 및 강사진(강의 자료)의 부족한 부분 파악 가능

'FeedA(피다)'는 AI 기반의 수업 피드백을 통해 학습 환경 향상을 목표로 합니다. 
아래 링크에 접속하여 FeedA를 직접 체험해 보세요!

[**🔗 배포된 웹 사이트 바로가기 Click !**](https://frontend-production-90dc.up.railway.app) 👈 <br>

> 새 창 열기 방법 : CTRL+click (on Windows and Linux) | CMD+click (on MacOS)

<br />

<div id="2"></div>

## 🛠 기술 스택

### **Front-end**

| <img src="https://profilinator.rishav.dev/skills-assets/html5-original-wordmark.svg" alt="HTML5" width="50px" height="50px" /> | <img src="https://profilinator.rishav.dev/skills-assets/css3-original-wordmark.svg" alt="CSS3" width="50px" height="50px" /> | <img src="https://cdn.simpleicons.org/nextdotjs/000000" alt="Next.js" width="50px" height="50px" /> | <img src="https://profilinator.rishav.dev/skills-assets/typescript-original.svg" alt="TypeScript" width="50px" height="50px" /> | <img src="https://cdn.simpleicons.org/tailwindcss/06B6D4" alt="Tailwind CSS" width="50px" height="50px" /> |
| :----------------------------------------------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------------------: |
| HTML5 | CSS3 | Next.js | TypeScript | Tailwind CSS |

### **Back-end**

| <img src="https://cdn.simpleicons.org/fastapi/05998B" alt="FastAPI" width="50px" height="50px" /> |
| :-----------------------------------------------------------------------------------------------: |
| FastAPI |

### **Deployment & DevOps**

| <img src="https://profilinator.rishav.dev/skills-assets/docker-original-wordmark.svg" alt="Docker" width="50px" height="50px" /> | <img src="https://cdn.simpleicons.org/railway/000000" alt="Railway" width="50px" height="50px" /> |
| :------------------------------------------------------------------------------------------------------------------------------: | :-----------------------------------------------------------------------------------------------: |
| Docker | Railway |

### **Version Control**

| <img src="https://profilinator.rishav.dev/skills-assets/git-scm-icon.svg" alt="Git" width="50px" height="50px" /> | <img src="https://cdn.jsdelivr.net/npm/simple-icons@3.0.1/icons/github.svg" alt="GitHub" width="50px" height="50px" /> |
| :---------------------------------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------------------------------: |
| Git | GitHub |

### 🤖 AI-Driven Development (Vibe Coding)

| <img src="https://cdn.simpleicons.org/anthropic/755139" alt="Claude" width="50px" height="50px" /> | <img src="https://cdn.simpleicons.org/googlegemini/8E75B2" alt="Gemini" width="50px" height="50px" /> |
| :-----------------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------------: |
| Claude (Opus 4.6 / Code) | Gemini 3.1 Pro |


<br />

<div id="3"></div>

## 로컬 실행 방법

### 1. Backend 실행 (FastAPI)

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

### 2. Frontend 실행 (Next.js)

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

<br />


<div id="4"></div>

## 📅 개발 기간

2026년 04월 06일 ~ 04월 13일 (일주일)

<br>

<div id="5"></div>

## Git Convention

### **🔵 Branch & Issue Convention**

- `main` : 최종 배포 브랜치
- `feat` : 기능 단위 개발
- `fix` : 버그 및 오류 수정
- `style` : UI 스타일 관련 변경
- `refactor` : 코드 구조 개선 (성능 향상 포함)
- `chore` : 그 외 (문서, 환경 설정, 단순 주석)

### 예시

- Branch
    - feat/이슈 번호-기능명
    - ex) `feat/21-header`
- Issue
    - 이슈 항목: 개발 내용
    - ex) `feat: Header 구현`

### **🔵 Commit Convention**

- `feat` : 새로운 기능 추가
- `fix` : 버그, 오류 해결
- `build`: 빌드 시스템이나 외부 패키지 의존성에 변화를 준 경우
- `docs`: 문서 또는 주석만 바뀐 경우
- `perf`: 성능 향상을 위한 코드 변경
- `refactor`: 버그 픽스나 새 기능 추가 또는 기존 기능 수정, 성능 향상 용도가 아닌 ****코드 변경 (기능 상의 변화가 없는 경우)
- `style`: UI 스타일 관련 변경
- `test`: 새 테스트 추가 또는 존재하는 테스트 수정
- `ci` : CI관련 설정 수정에 대한 커밋
- `chore` : 그 외 자잘한 수정에 대한 커밋

```
ex)

fix: 시험 종료 기능 수정

[본문(선택 사항)]
```

FROM python:3.11-slim

# OS 패키지 업데이트 및 필수 도구 설치 (faster-whisper 등에 필요)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 의존성 설치 최적화
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 소스 복사
COPY . .

# Railway는 $PORT 환경 변수를 사용하므로 실행 명령에서 포트를 동적으로 할당받아야 합니다.
# 또한 모듈 경로가 app.main:app 인지 확인 필요 (현재 구조상 app/main.py 이므로 app.main:app가 맞음)
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
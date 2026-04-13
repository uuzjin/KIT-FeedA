# 1. 빌드 및 실행 베이스 이미지
FROM python:3.11-slim

# 2. 필수 시스템 패키지 설치
# ffmpeg: 음성 처리용
# libgomp1: faster-whisper(C++ 라이브러리) 실행용 필수
# build-essential: 일부 패키지 컴파일용
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libgomp1 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 3. 작업 디렉토리 설정
WORKDIR /app

# 4. pip 업그레이드 및 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# 5. 소스 코드 복사
COPY . .

# 6. 환경 변수 설정
# app 폴더를 모듈로 인식하게 함
ENV PYTHONPATH=/app
# 버퍼링을 비활성화하여 로그가 실시간으로 찍히게 함
ENV PYTHONUNBUFFERED=1

# 7. 실행 명령
# Railway는 $PORT 환경 변수를 통해 포트를 할당하므로 쉘 형태로 실행
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}

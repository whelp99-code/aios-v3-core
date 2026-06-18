# Rapid-MLX 추론 엔진 컨테이너
FROM python:3.10-slim

WORKDIR /app

# 시스템 패키지 설치
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Rapid-MLX 설치
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir rapid-mlx==0.6.79

# 모델 캐시 디렉토리 생성
RUN mkdir -p /app/models /app/cache
ENV HF_HOME=/app/cache
ENV RAPID_MLX_CACHE=/app/cache
ENV PYTHONUNBUFFERED=1

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/v1/models || exit 1

EXPOSE 8000

ENV RAPID_MLX_TELEMETRY=0

CMD ["bash", "-lc", "rapid-mlx serve ${RAPID_MLX_MODEL:-qwen3.5-9b-4bit} --port 8000 --host 0.0.0.0"]

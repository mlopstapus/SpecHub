FROM python:3.12-slim AS builder

WORKDIR /build
COPY pyproject.toml README.md ./
COPY src/ src/
RUN pip install --no-cache-dir .

FROM python:3.12-slim

WORKDIR /app

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

COPY alembic.ini ./
COPY alembic/ alembic/
COPY src/ src/
COPY scripts/ scripts/

RUN chmod -R g=u /app && \
    chown -R 1001:0 /app

USER 1001

EXPOSE 8000
CMD ["sh", "scripts/start.sh"]

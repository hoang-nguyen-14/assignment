FROM python:3.11.9-slim

WORKDIR /app

# Install system dependencies (needed for psycopg2 usually)
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application

ENV PYTHONPATH=/app

COPY ./scripts /app/scripts
COPY ./alembic.ini /app/

COPY ./app /app/app
COPY ./tests /app/tests

# Expose port 8000
EXPOSE 8000

CMD ["fastapi", "run", "--workers", "4", "app/main.py"]

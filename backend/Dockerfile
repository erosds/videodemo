FROM python:3.11-slim

# System libraries needed by matchms, gensim, pdfplumber, rdkit wheel
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        libglib2.0-0 \
        libgl1 \
        libxrender1 \
        libxext6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first to maximise layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source (excludes what is in .dockerignore)
COPY . .

# Ensure writable runtime dirs exist inside the image so volumes can overlay them
RUN mkdir -p \
        /app/datasets/molecule_finder/models \
        /app/datasets/chemical_compliance \
        /app/trained_models

EXPOSE 8000

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

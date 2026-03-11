# Demo Platform

Interactive platform showcasing AI/ML workflows for scientific data analysis. Built with React + Tailwind CSS and a Python/FastAPI backend, with horizontal snap-scroll navigation and animated section transitions.

---

## Workflows

### 1. MaterialsFlow — *materials informatics*
Conceptual walkthrough of an AI-accelerated material discovery pipeline: generate molecular candidates, predict properties with ML/DL models, select top compounds against target criteria, and validate through computational methods. Interactive molecule grid renders real pharmaceutical structures from SMILES.

### 2. PredictLab — *real-time ML training*
Live classification pipeline on tabular datasets. Select one or more algorithms, trigger training, and compare accuracy, F1, AUC-ROC and overfit metrics across models in real time over WebSocket. Feature importance is ranked post-training to highlight which variables drive predictions most.

### 3. DeepSpectrum — *LC-MS/MS compound identification*
Compound identification from mass spectrometry data. Three algorithms are compared side by side: classical fragment-matching against a public reference library (MassBank Europe), focused spectral matching against a curated domain-specific collection, and AI similarity search based on learned spectrum embeddings (Spec2Vec). Includes anomaly detection and 3-D PCA visualisation of the embedding space.

### 4. MoleculeFinder — *AI-driven molecular design*
Multi-objective generative pipeline for molecular design. Molecules are encoded as fingerprints and physicochemical descriptors; property prediction models (LightGBM, Random Forest) are trained on curated datasets; NSGA-II evolves a population of novel candidates optimising two or three conflicting objectives simultaneously, producing a Pareto-optimal frontier. Three domain use cases: CNS lipophilicity-guided lead optimisation, sweetness enhancer discovery, and citrus aroma for beverages.

### 5. ChemAssistant — *local RAG for chemical QA/QC*
Local conversational assistant for QA/QC laboratories. Upload SOPs, safety data sheets, regulatory documents, and certificates of analysis; ask compliance questions in natural language and receive answers grounded in your own document corpus. Additional tools: batch CoA comparison with deviation flagging, ingredient check against EU Cosmetics Regulation 1223/2009, and a full audit trail exportable as JSON. All processing runs locally via Ollama (LLaMA 3) and a Qdrant vector database.

---

## Stack

| Frontend | Backend |
|---|---|
| React 19, Tailwind CSS | FastAPI, uvicorn |
| smiles-drawer | scikit-learn, LightGBM, RDKit |
| SVG charts | matchms, gensim (Spec2Vec) |
| WebSocket client | Ollama (LLaMA 3), Qdrant |

---

## Installation

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20+ | `npm` included |
| Python | 3.12 | 3.11 also works |
| Ollama | latest | [ollama.com](https://ollama.com) |
| Docker | latest | for Qdrant |

### 1 — Clone the repository

```bash
git clone https://github.com/erosds/demoplatform.git
cd demoplatform
```

### 2 — Frontend

```bash
npm install
npm start
```

Runs at `http://localhost:3000`.

### 3 — Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Runs at `http://localhost:8000`.

### 4 — Qdrant (required for ChemAssistant)

```bash
docker run -d --name qdrant -p 6333:6333 qdrant/qdrant
```

### 5 — Ollama (required for ChemAssistant)

```bash
# Install from https://ollama.com, then pull the required models:
ollama pull llama3
ollama pull nomic-embed-text
```

> **Note:** Qdrant and Ollama are only needed for the ChemAssistant workflow. All other workflows run with the frontend + FastAPI backend alone.

---

## Navigation

| Key | Action |
|---|---|
| ← → | Navigate sections |
| Esc | Back to home |
| Click dots / arrows | Jump to section |

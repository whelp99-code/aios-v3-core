"""
LightRAG Python Server

A FastAPI server that provides graph-based RAG (Retrieval Augmented Generation)
using LightRAG with LM Studio for embeddings.

Endpoints:
  POST /index  - Index documents into the knowledge graph
  POST /query  - Query the knowledge graph
  GET  /health - Health check (server + LM Studio connection)
"""

import os
import logging
from typing import Optional
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

LM_STUDIO_URL = os.getenv("LM_STUDIO_URL", "http://localhost:1234")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-nomic-embed-text-v1.5")
EMBEDDING_DIMENSIONS = int(os.getenv("EMBEDDING_DIMENSIONS", "768"))
GRAPH_STORAGE_PATH = os.getenv("GRAPH_STORAGE_PATH", "./data/lightrag")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("lightrag-server")

# ---------------------------------------------------------------------------
# In-memory graph store (simplified LightRAG-like structure)
# ---------------------------------------------------------------------------

class GraphStore:
    """Simplified graph store that holds nodes, edges, and embeddings."""

    def __init__(self):
        self.nodes: dict[str, dict] = {}
        self.edges: list[dict] = []
        self.embeddings: dict[str, list[float]] = {}

    def add_node(self, node_id: str, content: str, metadata: dict | None = None):
        self.nodes[node_id] = {
            "id": node_id,
            "content": content,
            "metadata": metadata or {},
        }

    def add_edge(self, source: str, target: str, relation: str, weight: float = 1.0):
        self.edges.append({
            "source": source,
            "target": target,
            "relation": relation,
            "weight": weight,
        })

    def store_embedding(self, node_id: str, embedding: list[float]):
        self.embeddings[node_id] = embedding

    def search_similar(self, query_embedding: list[float], top_k: int = 10) -> list[tuple[str, float]]:
        """Find nodes most similar to the query embedding using cosine similarity."""
        if not self.embeddings:
            return []

        scores: list[tuple[str, float]] = []
        for node_id, emb in self.embeddings.items():
            score = self._cosine_similarity(query_embedding, emb)
            scores.append((node_id, score))

        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:top_k]

    @staticmethod
    def _cosine_similarity(a: list[float], b: list[float]) -> float:
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x * x for x in a) ** 0.5
        norm_b = sum(x * x for x in b) ** 0.5
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)


graph_store = GraphStore()

# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("LightRAG server starting up")
    logger.info("LM Studio endpoint: %s", LM_STUDIO_URL)
    logger.info("Embedding model: %s", EMBEDDING_MODEL)
    yield
    logger.info("LightRAG server shutting down")

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="LightRAG Server",
    description="Graph-based RAG with LM Studio embeddings for AIOS",
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class DocumentPayload(BaseModel):
    """Single document to index."""
    id: str = Field(..., description="Unique document identifier")
    content: str = Field(..., description="Document text content")
    metadata: dict | None = Field(default=None, description="Optional metadata")

class BatchIndexRequest(BaseModel):
    """Either a single document or a batch."""
    documents: list[DocumentPayload] | None = Field(default=None, description="Batch of documents")
    # Allow bare fields for single-doc convenience
    id: str | None = Field(default=None)
    content: str | None = Field(default=None)
    metadata: dict | None = Field(default=None)

class IndexResponse(BaseModel):
    success: bool
    message: str
    nodes_created: int
    edges_created: int

class QueryRequest(BaseModel):
    query: str = Field(..., description="Natural language query")
    max_results: int = Field(default=10, ge=1, le=100)
    include_sources: bool = Field(default=False)

class QueryResultItem(BaseModel):
    content: str
    score: float
    node_id: str
    metadata: dict | None = None

class QueryResponse(BaseModel):
    success: bool
    query: str
    results: list[QueryResultItem]
    total_results: int

class HealthResponse(BaseModel):
    status: str
    server: str
    lm_studio_connected: bool

# ---------------------------------------------------------------------------
# Embedding helpers
# ---------------------------------------------------------------------------

async def get_embedding(text: str) -> list[float]:
    """Fetch an embedding vector from LM Studio."""
    url = f"{LM_STUDIO_URL}/v1/embeddings"
    payload = {
        "model": EMBEDDING_MODEL,
        "input": text,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["data"][0]["embedding"]
        except httpx.HTTPError as exc:
            logger.error("Embedding request failed: %s", exc)
            raise HTTPException(
                status_code=502,
                detail=f"Failed to get embedding from LM Studio: {exc}",
            )

async def get_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Fetch embeddings for multiple texts in one request (batch)."""
    url = f"{LM_STUDIO_URL}/v1/embeddings"
    payload = {
        "model": EMBEDDING_MODEL,
        "input": texts,
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            # Sort by index to maintain order
            sorted_data = sorted(data["data"], key=lambda x: x["index"])
            return [item["embedding"] for item in sorted_data]
        except httpx.HTTPError as exc:
            logger.error("Batch embedding request failed: %s", exc)
            raise HTTPException(
                status_code=502,
                detail=f"Failed to get embeddings from LM Studio: {exc}",
            )

# ---------------------------------------------------------------------------
# Simple entity extraction (rule-based fallback)
# ---------------------------------------------------------------------------

def extract_entities(text: str) -> list[str]:
    """Extract simple entity-like tokens from text.

    In production, this would use an LLM or NER model.
    This is a lightweight fallback that capitalizes word sequences.
    """
    import re
    # Grab capitalized words / acronyms as simple entities
    entities = re.findall(r'\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\b', text)
    # Also grab quoted terms
    quoted = re.findall(r'"([^"]+)"', text)
    entities.extend(quoted)
    return list(set(entities))

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check server health and LM Studio connectivity."""
    lm_studio_ok = False
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{LM_STUDIO_URL}/v1/models")
            lm_studio_ok = resp.status_code == 200
    except Exception:
        pass

    return HealthResponse(
        status="ok",
        server="lightrag",
        lm_studio_connected=lm_studio_ok,
    )


@app.post("/index", response_model=IndexResponse)
async def index_documents(payload: BatchIndexRequest):
    """Index one or more documents into the LightRAG knowledge graph.

    The server will:
    1. Extract entities from each document
    2. Build relationship edges between co-occurring entities
    3. Generate embeddings via LM Studio
    4. Store everything in the graph store
    """
    # Normalize into a list
    docs: list[DocumentPayload] = []
    if payload.documents:
        docs = payload.documents
    elif payload.id and payload.content:
        docs = [DocumentPayload(id=payload.id, content=payload.content, metadata=payload.metadata)]
    else:
        raise HTTPException(status_code=400, detail="Provide either 'documents' array or 'id' + 'content'")

    nodes_created = 0
    edges_created = 0

    texts = [d.content for d in docs]

    # Get embeddings in batch
    try:
        embeddings = await get_embeddings_batch(texts)
    except HTTPException:
        # If batch fails, try one by one
        embeddings = []
        for text in texts:
            emb = await get_embedding(text)
            embeddings.append(emb)

    # Process each document
    for doc, embedding in zip(docs, embeddings):
        # Add document node
        graph_store.add_node(doc.id, doc.content, doc.metadata)
        graph_store.store_embedding(doc.id, embedding)
        nodes_created += 1

        # Extract entities and create entity nodes + edges
        entities = extract_entities(doc.content)
        for entity in entities:
            entity_id = f"entity:{entity.lower().replace(' ', '_')}"
            if entity_id not in graph_store.nodes:
                graph_store.add_node(entity_id, entity, {"type": "entity"})
                nodes_created += 1

            # Edge from document to entity
            graph_store.add_edge(doc.id, entity_id, "contains")
            edges_created += 1

        # Create edges between co-occurring entities
        for i, e1 in enumerate(entities):
            for e2 in entities[i + 1:]:
                id1 = f"entity:{e1.lower().replace(' ', '_')}"
                id2 = f"entity:{e2.lower().replace(' ', '_')}"
                graph_store.add_edge(id1, id2, "co_occurs")
                edges_created += 1

    logger.info("Indexed %d documents: %d nodes, %d edges", len(docs), nodes_created, edges_created)

    return IndexResponse(
        success=True,
        message=f"Indexed {len(docs)} document(s) successfully",
        nodes_created=nodes_created,
        edges_created=edges_created,
    )


@app.post("/query", response_model=QueryResponse)
async def query_graph(request: QueryRequest):
    """Query the LightRAG knowledge graph.

    Performs graph-based retrieval by:
    1. Embedding the query via LM Studio
    2. Finding the most similar nodes via cosine similarity
    3. Expanding results through graph traversal (1-hop neighbors)
    4. Returning ranked results
    """
    # Get query embedding
    query_embedding = await get_embedding(request.query)

    # Find similar nodes
    similar_nodes = graph_store.search_similar(query_embedding, top_k=request.max_results)

    # Expand with 1-hop neighbors
    expanded: dict[str, float] = {}
    for node_id, score in similar_nodes:
        expanded[node_id] = score

        # Find neighbors
        for edge in graph_store.edges:
            neighbor = None
            if edge["source"] == node_id:
                neighbor = edge["target"]
            elif edge["target"] == node_id:
                neighbor = edge["source"]

            if neighbor and neighbor not in expanded:
                # Give neighbors a discounted score
                expanded[neighbor] = score * 0.7

    # Build results
    results: list[QueryResultItem] = []
    for node_id, score in sorted(expanded.items(), key=lambda x: x[1], reverse=True)[:request.max_results]:
        node = graph_store.nodes.get(node_id)
        if node:
            results.append(QueryResultItem(
                content=node["content"],
                score=round(score, 4),
                node_id=node_id,
                metadata=node.get("metadata"),
            ))

    return QueryResponse(
        success=True,
        query=request.query,
        results=results,
        total_results=len(results),
    )


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3300)

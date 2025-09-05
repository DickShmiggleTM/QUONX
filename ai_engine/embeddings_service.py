"""
Embeddings Service for QUONX AI Engine
Provides local text embeddings using sentence-transformers
"""

import asyncio
import logging
import numpy as np
from typing import List, Union
import threading

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    logging.warning("sentence-transformers not available, using mock embeddings")

logger = logging.getLogger(__name__)

class MockSentenceTransformer:
    """Mock SentenceTransformer for development"""
    
    def __init__(self, model_name: str):
        self.model_name = model_name
        self.embedding_dim = 384  # Common embedding dimension
        logger.info(f"Mock SentenceTransformer initialized with {model_name}")
    
    def encode(self, sentences: Union[str, List[str]], **kwargs) -> np.ndarray:
        """Generate mock embeddings"""
        if isinstance(sentences, str):
            sentences = [sentences]
        
        # Generate deterministic mock embeddings based on text hash
        embeddings = []
        for sentence in sentences:
            # Simple hash-based embedding generation
            hash_val = hash(sentence)
            np.random.seed(abs(hash_val) % (2**32))
            embedding = np.random.normal(0, 1, self.embedding_dim)
            # Normalize to unit vector
            embedding = embedding / np.linalg.norm(embedding)
            embeddings.append(embedding)
        
        return np.array(embeddings)

class EmbeddingsService:
    """Service for generating text embeddings"""
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self.model = None
        self.lock = threading.Lock()
        self._load_model()
    
    def _load_model(self):
        """Load the sentence transformer model"""
        try:
            logger.info(f"Loading embeddings model: {self.model_name}")
            
            if SENTENCE_TRANSFORMERS_AVAILABLE:
                self.model = SentenceTransformer(self.model_name)
            else:
                self.model = MockSentenceTransformer(self.model_name)
            
            logger.info(f"Embeddings model loaded successfully")
            
        except Exception as e:
            logger.error(f"Failed to load embeddings model: {e}")
            # Fallback to mock model
            self.model = MockSentenceTransformer(self.model_name)
    
    async def embed(self, text: Union[str, List[str]]) -> np.ndarray:
        """Generate embeddings for text"""
        if self.model is None:
            raise RuntimeError("Embeddings model not loaded")
        
        def _encode():
            with self.lock:
                return self.model.encode(text, convert_to_numpy=True)
        
        # Run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        embeddings = await loop.run_in_executor(None, _encode)
        
        return embeddings
    
    async def embed_batch(self, texts: List[str], batch_size: int = 32) -> np.ndarray:
        """Generate embeddings for a batch of texts"""
        if not texts:
            return np.array([])
        
        all_embeddings = []
        
        # Process in batches to manage memory
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch_embeddings = await self.embed(batch)
            all_embeddings.append(batch_embeddings)
        
        return np.vstack(all_embeddings)
    
    def similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """Calculate cosine similarity between two embeddings"""
        # Ensure embeddings are 1D
        if embedding1.ndim > 1:
            embedding1 = embedding1.flatten()
        if embedding2.ndim > 1:
            embedding2 = embedding2.flatten()
        
        # Calculate cosine similarity
        dot_product = np.dot(embedding1, embedding2)
        norm1 = np.linalg.norm(embedding1)
        norm2 = np.linalg.norm(embedding2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return dot_product / (norm1 * norm2)
    
    def find_most_similar(self, query_embedding: np.ndarray, 
                         candidate_embeddings: np.ndarray,
                         top_k: int = 5) -> List[tuple]:
        """Find the most similar embeddings to a query"""
        if candidate_embeddings.size == 0:
            return []
        
        similarities = []
        for i, candidate in enumerate(candidate_embeddings):
            sim = self.similarity(query_embedding, candidate)
            similarities.append((i, sim))
        
        # Sort by similarity (descending)
        similarities.sort(key=lambda x: x[1], reverse=True)
        
        return similarities[:top_k]
    
    def get_embedding_dimension(self) -> int:
        """Get the dimension of embeddings produced by this model"""
        if hasattr(self.model, 'get_sentence_embedding_dimension'):
            return self.model.get_sentence_embedding_dimension()
        elif hasattr(self.model, 'embedding_dim'):
            return self.model.embedding_dim
        else:
            # Default dimension for common models
            return 384
    
    def get_model_info(self) -> dict:
        """Get information about the loaded model"""
        return {
            "model_name": self.model_name,
            "embedding_dimension": self.get_embedding_dimension(),
            "available": self.model is not None,
            "backend": "sentence-transformers" if SENTENCE_TRANSFORMERS_AVAILABLE else "mock"
        }
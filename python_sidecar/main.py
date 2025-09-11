#!/usr/bin/env python3
"""
Quonx IDE Python Sidecar
FastAPI server for AI inference using llama.cpp
"""

import argparse
import asyncio
import json
import logging
import os
import sys
from pathlib import Path
from typing import Optional, List, Dict, Any
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Request/Response models
class InferenceRequest(BaseModel):
    prompt: str
    model: str
    max_tokens: Optional[int] = 512
    temperature: Optional[float] = 0.7

class InferenceResponse(BaseModel):
    response: str
    tokens_used: Optional[int] = None
    model_used: str

class ModelInfo(BaseModel):
    name: str
    path: str
    size: int
    format: str
    parameters: Optional[int] = None

# Global variables
app = FastAPI(title="Quonx IDE AI Sidecar", version="1.0.0")
models_dir = Path("models")
current_model = None
llama_cpp_available = False

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def check_llama_cpp():
    """Check if llama-cpp-python is available"""
    global llama_cpp_available
    try:
        import llama_cpp
        llama_cpp_available = True
        logger.info("llama-cpp-python is available")
    except ImportError:
        logger.warning("llama-cpp-python not available. Install with: pip install llama-cpp-python")
        llama_cpp_available = False

def discover_models() -> List[ModelInfo]:
    """Discover available GGUF models in the models directory"""
    models = []
    
    if not models_dir.exists():
        models_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Created models directory: {models_dir}")
        return models
    
    for model_file in models_dir.glob("*.gguf"):
        try:
            size = model_file.stat().st_size
            models.append(ModelInfo(
                name=model_file.name,
                path=str(model_file),
                size=size,
                format="GGUF"
            ))
        except Exception as e:
            logger.error(f"Error reading model {model_file}: {e}")
    
    logger.info(f"Discovered {len(models)} models")
    return models

def load_model(model_path: str) -> bool:
    """Load a model using llama-cpp-python"""
    global current_model
    
    if not llama_cpp_available:
        logger.error("llama-cpp-python not available")
        return False
    
    try:
        from llama_cpp import Llama
        
        # Unload current model if any
        if current_model is not None:
            del current_model
            current_model = None
        
        # Load new model
        logger.info(f"Loading model: {model_path}")
        current_model = Llama(
            model_path=model_path,
            n_ctx=2048,
            n_gpu_layers=0,  # Will be configurable later
            verbose=False
        )
        logger.info("Model loaded successfully")
        return True
        
    except Exception as e:
        logger.error(f"Failed to load model {model_path}: {e}")
        return False

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "llama_cpp_available": llama_cpp_available,
        "current_model": current_model is not None
    }

@app.get("/models")
async def get_models():
    """Get list of available models"""
    models = discover_models()
    return {"models": [model.dict() for model in models]}

@app.post("/models/load")
async def load_model_endpoint(model_name: str):
    """Load a specific model"""
    model_path = models_dir / model_name
    if not model_path.exists():
        raise HTTPException(status_code=404, detail="Model not found")
    
    if load_model(str(model_path)):
        return {"status": "success", "model": model_name}
    else:
        raise HTTPException(status_code=500, detail="Failed to load model")

@app.post("/inference", response_model=InferenceResponse)
async def inference(request: InferenceRequest):
    """Perform AI inference"""
    if not llama_cpp_available:
        raise HTTPException(status_code=503, detail="llama-cpp-python not available")
    
    if current_model is None:
        raise HTTPException(status_code=400, detail="No model loaded")
    
    try:
        # Perform inference
        response = current_model(
            request.prompt,
            max_tokens=request.max_tokens,
            temperature=request.temperature,
            echo=False
        )
        
        # Extract the generated text
        generated_text = response['choices'][0]['text']
        
        return InferenceResponse(
            response=generated_text,
            tokens_used=response.get('usage', {}).get('total_tokens'),
            model_used=request.model
        )
        
    except Exception as e:
        logger.error(f"Inference error: {e}")
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Quonx IDE AI Sidecar",
        "version": "1.0.0",
        "endpoints": [
            "/health",
            "/models",
            "/models/load",
            "/inference"
        ]
    }

def main():
    parser = argparse.ArgumentParser(description="Quonx IDE AI Sidecar")
    parser.add_argument("--port", type=int, default=8000, help="Port to run the server on")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host to bind to")
    parser.add_argument("--models-dir", type=str, default="models", help="Directory containing models")
    
    args = parser.parse_args()
    
    # Update global models directory
    global models_dir
    models_dir = Path(args.models_dir)
    
    # Check dependencies
    check_llama_cpp()
    
    # Discover models
    models = discover_models()
    if models:
        logger.info(f"Available models: {[m.name for m in models]}")
    
    # Start the server
    logger.info(f"Starting Quonx IDE AI Sidecar on {args.host}:{args.port}")
    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        log_level="info"
    )

if __name__ == "__main__":
    main()
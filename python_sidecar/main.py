#!/usr/bin/env python3
"""Quonx IDE Python Sidecar.

This script provides a FastAPI server for AI inference using llama.cpp.
It is designed to be used as a sidecar for the Quonx IDE, providing AI
capabilities such as code completion and generation.
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
    """Represents a request for AI inference.

    Attributes:
        prompt: The text prompt to send to the model.
        model: The name of the model to use for inference.
        max_tokens: The maximum number of tokens to generate.
        temperature: The temperature to use for sampling.
    """
    prompt: str
    model: str
    max_tokens: Optional[int] = 512
    temperature: Optional[float] = 0.7

class InferenceResponse(BaseModel):
    """Represents the response from an AI inference request.

    Attributes:
        response: The generated text from the model.
        tokens_used: The number of tokens used for the inference.
        model_used: The name of the model that was used.
    """
    response: str
    tokens_used: Optional[int] = None
    model_used: str

class ModelInfo(BaseModel):
    """Represents information about an available model.

    Attributes:
        name: The name of the model file.
        path: The path to the model file.
        size: The size of the model file in bytes.
        format: The format of the model (e.g., GGUF).
        parameters: The number of parameters in the model.
    """
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
    """Checks if the llama-cpp-python library is installed.

    This function attempts to import the `llama_cpp` library and sets the
    `llama_cpp_available` global variable accordingly.
    """
    global llama_cpp_available
    try:
        import llama_cpp
        llama_cpp_available = True
        logger.info("llama-cpp-python is available")
    except ImportError:
        logger.warning("llama-cpp-python not available. Install with: pip install llama-cpp-python")
        llama_cpp_available = False

def discover_models() -> List[ModelInfo]:
    """Discovers available GGUF models in the models directory.

    This function scans the `models_dir` for files with the `.gguf` extension
    and returns a list of `ModelInfo` objects.

    Returns:
        A list of `ModelInfo` objects representing the discovered models.
    """
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
    """Loads a model using llama-cpp-python.

    Args:
        model_path: The path to the model file to load.

    Returns:
        True if the model was loaded successfully, False otherwise.
    """
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
    """Provides a health check endpoint for the server.

    This endpoint can be used to monitor the status of the server and its
    dependencies.

    Returns:
        A dictionary containing the health status of the server.
    """
    return {
        "status": "healthy",
        "llama_cpp_available": llama_cpp_available,
        "current_model": current_model is not None
    }

@app.get("/models")
async def get_models():
    """Gets the list of available models.

    This endpoint discovers and returns a list of all available models
    in the `models_dir`.

    Returns:
        A dictionary containing a list of available models.
    """
    models = discover_models()
    return {"models": [model.dict() for model in models]}

@app.post("/models/load")
async def load_model_endpoint(model_name: str):
    """Loads a specific model.

    This endpoint loads the model specified by `model_name` into memory,
    making it available for inference.

    Args:
        model_name: The name of the model to load.

    Returns:
        A dictionary indicating the status of the model loading operation.

    Raises:
        HTTPException: If the model is not found or fails to load.
    """
    model_path = models_dir / model_name
    if not model_path.exists():
        raise HTTPException(status_code=404, detail="Model not found")
    
    if load_model(str(model_path)):
        return {"status": "success", "model": model_name}
    else:
        raise HTTPException(status_code=500, detail="Failed to load model")

@app.post("/inference", response_model=InferenceResponse)
async def inference(request: InferenceRequest):
    """Performs AI inference on the loaded model.

    This endpoint takes a prompt and other parameters, performs inference
    using the currently loaded model, and returns the generated text.

    Args:
        request: An `InferenceRequest` object containing the prompt and other
                 parameters.

    Returns:
        An `InferenceResponse` object containing the generated text and other
        information.

    Raises:
        HTTPException: If `llama-cpp-python` is not available, no model is
                     loaded, or if an error occurs during inference.
    """
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
    """Provides a root endpoint for the server.

    This endpoint returns basic information about the AI sidecar, including
    its name, version, and a list of available endpoints.

    Returns:
        A dictionary containing basic information about the server.
    """
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
    """The main entry point for the AI sidecar server.

    This function parses command-line arguments, checks for dependencies,
    discovers available models, and starts the FastAPI server.
    """
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
#!/usr/bin/env python3
"""
QUONX AI Engine - Local LLM Inference Server
Provides local AI inference using llama.cpp with multi-model support
"""

import argparse
import asyncio
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Any
import signal
import psutil

import uvicorn
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from model_manager import ModelManager
from inference_engine import InferenceEngine
from embeddings_service import EmbeddingsService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Request/Response models
class GenerateRequest(BaseModel):
    message: str
    role: str = "chat"
    context: Optional[str] = None
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=2048, ge=1, le=8192)
    top_p: float = Field(default=0.95, ge=0.0, le=1.0)
    top_k: int = Field(default=40, ge=1, le=100)

class GenerateResponse(BaseModel):
    response: str
    model: str
    tokens_used: Optional[int] = None
    processing_time: float
    role: str

class LoadModelRequest(BaseModel):
    model: str
    role: str

class ModelInfo(BaseModel):
    name: str
    size: str
    quantization: str
    context_length: int
    is_loaded: bool
    role: Optional[str] = None

class HealthResponse(BaseModel):
    status: str
    uptime: float
    models_loaded: int
    memory_usage: Dict[str, Any]

class AIEngine:
    def __init__(self, models_dir: Path, port: int = 8765):
        self.models_dir = models_dir
        self.port = port
        self.start_time = time.time()
        
        # Initialize components
        self.model_manager = ModelManager(models_dir)
        self.inference_engine = InferenceEngine()
        self.embeddings_service = EmbeddingsService()
        
        # Create FastAPI app
        self.app = FastAPI(
            title="QUONX AI Engine",
            description="Local LLM inference server for QUONX IDE",
            version="0.1.0"
        )
        
        # Add CORS middleware
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["http://localhost:5173", "tauri://localhost"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        
        # Setup routes
        self._setup_routes()
        
        # Setup signal handlers
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    def _setup_routes(self):
        @self.app.get("/health", response_model=HealthResponse)
        async def health():
            """Health check endpoint"""
            process = psutil.Process()
            memory_info = process.memory_info()
            
            return HealthResponse(
                status="healthy",
                uptime=time.time() - self.start_time,
                models_loaded=len(self.inference_engine.loaded_models),
                memory_usage={
                    "rss": memory_info.rss,
                    "vms": memory_info.vms,
                    "percent": process.memory_percent()
                }
            )

        @self.app.get("/models", response_model=List[ModelInfo])
        async def list_models():
            """List all available models"""
            models = []
            available_models = self.model_manager.list_models()
            loaded_models = self.inference_engine.loaded_models
            
            for model_path in available_models:
                model_name = model_path.stem
                is_loaded = model_name in loaded_models
                role = None
                
                if is_loaded:
                    role = loaded_models[model_name].get("role")
                
                # Parse model info from filename
                size, quantization = self._parse_model_info(model_name)
                
                models.append(ModelInfo(
                    name=model_name,
                    size=size,
                    quantization=quantization,
                    context_length=4096,  # Default, could be parsed from model
                    is_loaded=is_loaded,
                    role=role
                ))
            
            return models

        @self.app.post("/load_model")
        async def load_model(request: LoadModelRequest):
            """Load a model for a specific role"""
            try:
                model_path = self.model_manager.get_model_path(request.model)
                if not model_path:
                    raise HTTPException(status_code=404, detail=f"Model {request.model} not found")
                
                success = await self.inference_engine.load_model(
                    request.model, 
                    model_path, 
                    request.role
                )
                
                if success:
                    return {"status": "success", "message": f"Model {request.model} loaded for role {request.role}"}
                else:
                    raise HTTPException(status_code=500, detail="Failed to load model")
                    
            except Exception as e:
                logger.error(f"Error loading model: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.post("/unload_model")
        async def unload_model(model_name: str):
            """Unload a model"""
            try:
                success = await self.inference_engine.unload_model(model_name)
                if success:
                    return {"status": "success", "message": f"Model {model_name} unloaded"}
                else:
                    raise HTTPException(status_code=404, detail="Model not found or not loaded")
            except Exception as e:
                logger.error(f"Error unloading model: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.post("/generate", response_model=GenerateResponse)
        async def generate(request: GenerateRequest):
            """Generate text using the specified role's model"""
            start_time = time.time()
            
            try:
                # Get the model for the specified role
                model_info = self.inference_engine.get_model_for_role(request.role)
                if not model_info:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"No model loaded for role: {request.role}"
                    )
                
                # Generate response
                response_text, tokens_used = await self.inference_engine.generate(
                    model_name=model_info["name"],
                    prompt=request.message,
                    context=request.context,
                    temperature=request.temperature,
                    max_tokens=request.max_tokens,
                    top_p=request.top_p,
                    top_k=request.top_k
                )
                
                processing_time = time.time() - start_time
                
                return GenerateResponse(
                    response=response_text,
                    model=model_info["name"],
                    tokens_used=tokens_used,
                    processing_time=processing_time,
                    role=request.role
                )
                
            except Exception as e:
                logger.error(f"Error generating response: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.post("/embed")
        async def embed_text(text: str):
            """Generate embeddings for text"""
            try:
                embeddings = await self.embeddings_service.embed(text)
                return {"embeddings": embeddings.tolist()}
            except Exception as e:
                logger.error(f"Error generating embeddings: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.post("/shutdown")
        async def shutdown(background_tasks: BackgroundTasks):
            """Graceful shutdown endpoint"""
            logger.info("Shutdown requested")
            background_tasks.add_task(self._shutdown)
            return {"status": "shutting down"}

    def _parse_model_info(self, model_name: str) -> tuple[str, str]:
        """Parse model size and quantization from filename"""
        name_lower = model_name.lower()
        
        # Extract size
        size = "Unknown"
        if "7b" in name_lower:
            size = "7B"
        elif "13b" in name_lower:
            size = "13B"
        elif "34b" in name_lower:
            size = "34B"
        elif "70b" in name_lower:
            size = "70B"
        
        # Extract quantization
        quantization = "Unknown"
        if "q4_0" in name_lower:
            quantization = "Q4_0"
        elif "q4_1" in name_lower:
            quantization = "Q4_1"
        elif "q5_0" in name_lower:
            quantization = "Q5_0"
        elif "q5_1" in name_lower:
            quantization = "Q5_1"
        elif "q8_0" in name_lower:
            quantization = "Q8_0"
        elif "f16" in name_lower:
            quantization = "F16"
        elif "f32" in name_lower:
            quantization = "F32"
        
        return size, quantization

    async def _shutdown(self):
        """Perform graceful shutdown"""
        logger.info("Performing graceful shutdown...")
        
        # Unload all models
        await self.inference_engine.shutdown()
        
        # Stop the server
        await asyncio.sleep(1)
        os._exit(0)

    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        logger.info(f"Received signal {signum}, shutting down...")
        asyncio.create_task(self._shutdown())

    async def start(self):
        """Start the AI engine server"""
        logger.info(f"Starting QUONX AI Engine on port {self.port}")
        logger.info(f"Models directory: {self.models_dir}")
        
        # Initialize models directory
        self.models_dir.mkdir(parents=True, exist_ok=True)
        
        # Discover available models
        available_models = self.model_manager.list_models()
        logger.info(f"Found {len(available_models)} models")
        
        # Start the server
        config = uvicorn.Config(
            self.app,
            host="127.0.0.1",
            port=self.port,
            log_level="info",
            access_log=False
        )
        server = uvicorn.Server(config)
        await server.serve()

def main():
    parser = argparse.ArgumentParser(description="QUONX AI Engine")
    parser.add_argument("--port", type=int, default=8765, help="Port to run the server on")
    parser.add_argument("--models-dir", type=Path, default="./models", help="Directory containing GGUF models")
    parser.add_argument("--log-level", default="INFO", help="Logging level")
    
    args = parser.parse_args()
    
    # Set logging level
    logging.getLogger().setLevel(getattr(logging, args.log_level.upper()))
    
    # Create and start the AI engine
    engine = AIEngine(args.models_dir, args.port)
    
    try:
        asyncio.run(engine.start())
    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt, shutting down...")
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
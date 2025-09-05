"""
Inference Engine for QUONX AI Engine
Handles model loading and text generation using llama.cpp
"""

import asyncio
import logging
import threading
from pathlib import Path
from typing import Dict, Optional, Tuple, Any
import time

try:
    from llama_cpp import Llama
    LLAMA_CPP_AVAILABLE = True
except ImportError:
    LLAMA_CPP_AVAILABLE = False
    logging.warning("llama-cpp-python not available, using mock inference")

logger = logging.getLogger(__name__)

class MockLlama:
    """Mock Llama class for development when llama-cpp-python is not available"""
    
    def __init__(self, *args, **kwargs):
        self.model_path = kwargs.get('model_path', 'mock_model')
        logger.info(f"Mock Llama initialized with {self.model_path}")
    
    def __call__(self, prompt: str, max_tokens: int = 256, temperature: float = 0.7, 
                 top_p: float = 0.95, top_k: int = 40, **kwargs) -> Dict[str, Any]:
        """Mock text generation"""
        time.sleep(0.5)  # Simulate processing time
        
        # Generate a mock response based on the prompt
        if "code" in prompt.lower():
            response = f"```python\n# Generated code for: {prompt[:50]}...\ndef example_function():\n    return 'Hello, World!'\n```"
        elif "explain" in prompt.lower():
            response = f"This is a mock explanation for: {prompt[:50]}... The concept involves multiple aspects that work together to achieve the desired outcome."
        else:
            response = f"This is a mock response to: {prompt[:50]}... I understand your request and would be happy to help with that."
        
        return {
            'choices': [{
                'text': response,
                'finish_reason': 'stop'
            }],
            'usage': {
                'prompt_tokens': len(prompt.split()),
                'completion_tokens': len(response.split()),
                'total_tokens': len(prompt.split()) + len(response.split())
            }
        }

class InferenceEngine:
    """Manages model loading and inference using llama.cpp"""
    
    def __init__(self):
        self.loaded_models: Dict[str, Dict[str, Any]] = {}
        self.model_locks: Dict[str, threading.Lock] = {}
        self.role_assignments: Dict[str, str] = {}  # role -> model_name
        
        # Default inference parameters
        self.default_params = {
            "temperature": 0.7,
            "top_p": 0.95,
            "top_k": 40,
            "max_tokens": 2048,
            "repeat_penalty": 1.1,
            "stop": ["</s>", "<|im_end|>", "<|endoftext|>"]
        }
    
    async def load_model(self, model_name: str, model_path: Path, role: str = "general") -> bool:
        """Load a model for inference"""
        try:
            if model_name in self.loaded_models:
                logger.info(f"Model {model_name} already loaded, updating role assignment")
                self.role_assignments[role] = model_name
                self.loaded_models[model_name]["role"] = role
                return True
            
            logger.info(f"Loading model {model_name} from {model_path} for role {role}")
            
            # Determine optimal parameters based on available memory
            n_ctx = 4096  # Context window
            n_gpu_layers = self._get_optimal_gpu_layers()
            
            # Load the model
            if LLAMA_CPP_AVAILABLE:
                model = Llama(
                    model_path=str(model_path),
                    n_ctx=n_ctx,
                    n_gpu_layers=n_gpu_layers,
                    verbose=False,
                    use_mmap=True,
                    use_mlock=False,
                    n_threads=None,  # Use all available threads
                )
            else:
                model = MockLlama(model_path=str(model_path))
            
            # Store model info
            self.loaded_models[model_name] = {
                "model": model,
                "path": model_path,
                "role": role,
                "n_ctx": n_ctx,
                "n_gpu_layers": n_gpu_layers,
                "load_time": time.time()
            }
            
            # Create a lock for this model
            self.model_locks[model_name] = threading.Lock()
            
            # Assign role
            self.role_assignments[role] = model_name
            
            logger.info(f"Successfully loaded model {model_name} for role {role}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load model {model_name}: {e}")
            return False
    
    async def unload_model(self, model_name: str) -> bool:
        """Unload a model from memory"""
        try:
            if model_name not in self.loaded_models:
                logger.warning(f"Model {model_name} not loaded")
                return False
            
            logger.info(f"Unloading model {model_name}")
            
            # Remove role assignment
            role = self.loaded_models[model_name]["role"]
            if role in self.role_assignments and self.role_assignments[role] == model_name:
                del self.role_assignments[role]
            
            # Clean up
            del self.loaded_models[model_name]
            if model_name in self.model_locks:
                del self.model_locks[model_name]
            
            logger.info(f"Successfully unloaded model {model_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to unload model {model_name}: {e}")
            return False
    
    async def generate(self, model_name: str, prompt: str, context: Optional[str] = None,
                      temperature: float = 0.7, max_tokens: int = 2048,
                      top_p: float = 0.95, top_k: int = 40) -> Tuple[str, Optional[int]]:
        """Generate text using the specified model"""
        
        if model_name not in self.loaded_models:
            raise ValueError(f"Model {model_name} not loaded")
        
        model_info = self.loaded_models[model_name]
        model = model_info["model"]
        
        # Prepare the full prompt
        full_prompt = prompt
        if context:
            full_prompt = f"Context: {context}\n\nQuery: {prompt}"
        
        # Use thread lock to ensure thread safety
        lock = self.model_locks[model_name]
        
        def _generate():
            with lock:
                try:
                    response = model(
                        full_prompt,
                        max_tokens=max_tokens,
                        temperature=temperature,
                        top_p=top_p,
                        top_k=top_k,
                        stop=self.default_params["stop"],
                        repeat_penalty=self.default_params["repeat_penalty"]
                    )
                    
                    if LLAMA_CPP_AVAILABLE:
                        text = response["choices"][0]["text"].strip()
                        tokens_used = response.get("usage", {}).get("total_tokens")
                    else:
                        text = response["choices"][0]["text"].strip()
                        tokens_used = response.get("usage", {}).get("total_tokens")
                    
                    return text, tokens_used
                    
                except Exception as e:
                    logger.error(f"Generation error: {e}")
                    raise
        
        # Run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _generate)
    
    def get_model_for_role(self, role: str) -> Optional[Dict[str, Any]]:
        """Get the model assigned to a specific role"""
        model_name = self.role_assignments.get(role)
        if model_name and model_name in self.loaded_models:
            return {
                "name": model_name,
                "info": self.loaded_models[model_name]
            }
        return None
    
    def get_loaded_models(self) -> Dict[str, Dict[str, Any]]:
        """Get information about all loaded models"""
        return self.loaded_models.copy()
    
    def get_role_assignments(self) -> Dict[str, str]:
        """Get current role to model assignments"""
        return self.role_assignments.copy()
    
    async def shutdown(self):
        """Shutdown the inference engine and unload all models"""
        logger.info("Shutting down inference engine...")
        
        model_names = list(self.loaded_models.keys())
        for model_name in model_names:
            await self.unload_model(model_name)
        
        logger.info("Inference engine shutdown complete")
    
    def _get_optimal_gpu_layers(self) -> int:
        """Determine optimal number of GPU layers based on available VRAM"""
        try:
            import torch
            if torch.cuda.is_available():
                # Get available VRAM
                gpu_memory = torch.cuda.get_device_properties(0).total_memory
                gpu_memory_gb = gpu_memory / (1024**3)
                
                # Rough estimation of layers based on VRAM
                if gpu_memory_gb >= 24:
                    return -1  # Use all layers
                elif gpu_memory_gb >= 12:
                    return 35
                elif gpu_memory_gb >= 8:
                    return 25
                elif gpu_memory_gb >= 6:
                    return 15
                elif gpu_memory_gb >= 4:
                    return 10
                else:
                    return 0
            else:
                return 0  # No GPU
        except ImportError:
            return 0  # PyTorch not available
        except Exception as e:
            logger.warning(f"Could not determine GPU layers: {e}")
            return 0
    
    def get_model_stats(self, model_name: str) -> Optional[Dict[str, Any]]:
        """Get statistics for a loaded model"""
        if model_name not in self.loaded_models:
            return None
        
        model_info = self.loaded_models[model_name]
        return {
            "name": model_name,
            "role": model_info["role"],
            "path": str(model_info["path"]),
            "context_length": model_info["n_ctx"],
            "gpu_layers": model_info["n_gpu_layers"],
            "load_time": model_info["load_time"],
            "uptime": time.time() - model_info["load_time"]
        }
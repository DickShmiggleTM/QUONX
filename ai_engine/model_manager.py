"""
Model Manager for QUONX AI Engine
Handles discovery, validation, and metadata for GGUF models
"""

import logging
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import json

logger = logging.getLogger(__name__)

class ModelManager:
    """Manages GGUF model discovery and metadata"""
    
    def __init__(self, models_dir: Path):
        self.models_dir = Path(models_dir)
        self.models_cache: Dict[str, Dict] = {}
        self._scan_models()
    
    def _scan_models(self):
        """Scan the models directory for GGUF files"""
        if not self.models_dir.exists():
            logger.warning(f"Models directory does not exist: {self.models_dir}")
            return
        
        logger.info(f"Scanning for models in: {self.models_dir}")
        
        # Find all .gguf files
        gguf_files = list(self.models_dir.rglob("*.gguf"))
        logger.info(f"Found {len(gguf_files)} GGUF files")
        
        for model_path in gguf_files:
            try:
                model_info = self._analyze_model(model_path)
                self.models_cache[model_path.stem] = model_info
                logger.debug(f"Cached model info for: {model_path.stem}")
            except Exception as e:
                logger.error(f"Failed to analyze model {model_path}: {e}")
    
    def _analyze_model(self, model_path: Path) -> Dict:
        """Analyze a GGUF model file and extract metadata"""
        stat = model_path.stat()
        
        # Basic file information
        model_info = {
            "path": str(model_path),
            "name": model_path.stem,
            "size_bytes": stat.st_size,
            "size_human": self._format_size(stat.st_size),
            "modified": stat.st_mtime,
        }
        
        # Parse model information from filename
        filename = model_path.stem.lower()
        
        # Detect model family
        if "llama" in filename:
            model_info["family"] = "LLaMA"
        elif "mistral" in filename:
            model_info["family"] = "Mistral"
        elif "codellama" in filename:
            model_info["family"] = "CodeLlama"
        elif "deepseek" in filename:
            model_info["family"] = "DeepSeek"
        elif "yi" in filename:
            model_info["family"] = "Yi"
        elif "phi" in filename:
            model_info["family"] = "Phi"
        else:
            model_info["family"] = "Unknown"
        
        # Detect parameter count
        if "7b" in filename:
            model_info["parameters"] = "7B"
        elif "13b" in filename:
            model_info["parameters"] = "13B"
        elif "34b" in filename:
            model_info["parameters"] = "34B"
        elif "70b" in filename:
            model_info["parameters"] = "70B"
        else:
            model_info["parameters"] = "Unknown"
        
        # Detect quantization
        if "q4_0" in filename:
            model_info["quantization"] = "Q4_0"
        elif "q4_1" in filename:
            model_info["quantization"] = "Q4_1"
        elif "q5_0" in filename:
            model_info["quantization"] = "Q5_0"
        elif "q5_1" in filename:
            model_info["quantization"] = "Q5_1"
        elif "q8_0" in filename:
            model_info["quantization"] = "Q8_0"
        elif "f16" in filename:
            model_info["quantization"] = "F16"
        elif "f32" in filename:
            model_info["quantization"] = "F32"
        else:
            model_info["quantization"] = "Unknown"
        
        # Estimate context length (default values by family)
        context_lengths = {
            "LLaMA": 4096,
            "Mistral": 8192,
            "CodeLlama": 16384,
            "DeepSeek": 16384,
            "Yi": 4096,
            "Phi": 2048,
        }
        model_info["context_length"] = context_lengths.get(model_info["family"], 4096)
        
        # Determine model capabilities
        model_info["capabilities"] = self._determine_capabilities(filename, model_info["family"])
        
        return model_info
    
    def _determine_capabilities(self, filename: str, family: str) -> List[str]:
        """Determine what the model is good for based on its name and family"""
        capabilities = []
        
        # Code-specific models
        if any(keyword in filename for keyword in ["code", "coder", "coding"]):
            capabilities.extend(["code_generation", "code_analysis", "debugging"])
        
        # Instruction-tuned models
        if any(keyword in filename for keyword in ["instruct", "chat", "assistant"]):
            capabilities.extend(["conversation", "instruction_following"])
        
        # Reasoning models
        if any(keyword in filename for keyword in ["reason", "think", "logic"]):
            capabilities.append("reasoning")
        
        # Family-specific capabilities
        if family == "CodeLlama":
            capabilities.extend(["code_generation", "code_analysis", "debugging"])
        elif family == "Mistral":
            capabilities.extend(["conversation", "instruction_following", "reasoning"])
        elif family == "DeepSeek":
            capabilities.extend(["code_generation", "reasoning"])
        elif family == "Phi":
            capabilities.extend(["reasoning", "conversation"])
        
        # Default capabilities if none detected
        if not capabilities:
            capabilities.append("general")
        
        return list(set(capabilities))  # Remove duplicates
    
    def _format_size(self, size_bytes: int) -> str:
        """Format file size in human-readable format"""
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.1f} PB"
    
    def list_models(self) -> List[Path]:
        """Get list of all available model paths"""
        return [Path(info["path"]) for info in self.models_cache.values()]
    
    def get_model_info(self, model_name: str) -> Optional[Dict]:
        """Get detailed information about a specific model"""
        return self.models_cache.get(model_name)
    
    def get_model_path(self, model_name: str) -> Optional[Path]:
        """Get the file path for a specific model"""
        info = self.models_cache.get(model_name)
        return Path(info["path"]) if info else None
    
    def get_models_by_capability(self, capability: str) -> List[str]:
        """Get models that have a specific capability"""
        matching_models = []
        for name, info in self.models_cache.items():
            if capability in info.get("capabilities", []):
                matching_models.append(name)
        return matching_models
    
    def get_recommended_models(self) -> Dict[str, str]:
        """Get recommended models for each role"""
        recommendations = {}
        
        # Chat role - prefer instruction-tuned models
        chat_models = self.get_models_by_capability("conversation")
        if chat_models:
            # Prefer smaller models for chat for faster response
            chat_models.sort(key=lambda x: self.models_cache[x]["size_bytes"])
            recommendations["chat"] = chat_models[0]
        
        # Code role - prefer code-specific models
        code_models = self.get_models_by_capability("code_generation")
        if code_models:
            # Prefer larger models for code for better quality
            code_models.sort(key=lambda x: self.models_cache[x]["size_bytes"], reverse=True)
            recommendations["code"] = code_models[0]
        
        # Reasoner role - prefer reasoning models
        reasoning_models = self.get_models_by_capability("reasoning")
        if reasoning_models:
            # Prefer larger models for reasoning
            reasoning_models.sort(key=lambda x: self.models_cache[x]["size_bytes"], reverse=True)
            recommendations["reasoner"] = reasoning_models[0]
        
        return recommendations
    
    def refresh(self):
        """Refresh the model cache by rescanning the directory"""
        self.models_cache.clear()
        self._scan_models()
    
    def export_model_info(self, output_path: Path):
        """Export model information to a JSON file"""
        with open(output_path, 'w') as f:
            json.dump(self.models_cache, f, indent=2, default=str)
        logger.info(f"Model information exported to: {output_path}")
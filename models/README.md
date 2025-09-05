# QUONX Models Directory

This directory is where you should place your GGUF model files for local AI inference.

## Recommended Models

### Chat Models (Conversational AI)
- **Mistral-7B-Instruct-v0.2.Q4_K_M.gguf** - Excellent general chat model
- **Yi-34B-Chat.Q4_K_M.gguf** - High-quality reasoning and conversation

### Code Models (Programming Assistant)
- **CodeLlama-34B-Instruct.Q4_K_M.gguf** - Specialized for code generation
- **DeepSeek-Coder-33B-Instruct.Q4_K_M.gguf** - Advanced coding capabilities

### Reasoning Models (Complex Analysis)
- **Yi-34B-Chat.Q4_K_M.gguf** - Strong logical reasoning
- **Phi-2.Q4_K_M.gguf** - Compact but powerful reasoning

## Where to Download Models

1. **Hugging Face**: https://huggingface.co/models?library=gguf
2. **TheBloke's Collections**: Search for "TheBloke" + model name + "GGUF"
3. **Official Model Repositories**: Many models now provide GGUF versions

## Model Naming Convention

The application automatically detects model capabilities based on filename patterns:
- Models with "code", "coder", "coding" → Code generation capabilities
- Models with "instruct", "chat", "assistant" → Conversation capabilities  
- Models with "reason", "think", "logic" → Reasoning capabilities

## Hardware Considerations

### VRAM Requirements (Approximate)
- **Q4_0/Q4_K_M**: ~4-6GB for 7B models, ~18-22GB for 34B models
- **Q5_0/Q5_K_M**: ~5-7GB for 7B models, ~22-26GB for 34B models
- **Q8_0**: ~7-9GB for 7B models, ~32-36GB for 34B models

### CPU Fallback
If you don't have enough VRAM, the application will automatically use CPU inference or hybrid CPU+GPU processing.

## Example Setup

```bash
# Download a model (example)
wget https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf

# Place it in this directory
mv mistral-7b-instruct-v0.2.Q4_K_M.gguf /path/to/QUONX/models/

# The application will automatically discover it on startup
```

## Model Management

The QUONX AI Engine provides:
- **Automatic Discovery**: Scans this directory on startup
- **Role Assignment**: Assign different models to chat, code, and reasoning roles
- **Memory Management**: Loads/unloads models as needed
- **Performance Monitoring**: Tracks inference speed and resource usage

## Troubleshooting

### Model Not Loading
1. Check file permissions (should be readable)
2. Verify GGUF format (not GGML or other formats)
3. Ensure sufficient RAM/VRAM available
4. Check application logs for specific error messages

### Slow Inference
1. Try a smaller quantization (Q4_0 instead of Q8_0)
2. Reduce context length in settings
3. Enable GPU acceleration if available
4. Consider using a smaller parameter model

### Out of Memory
1. Close other applications to free RAM
2. Use a more aggressive quantization (Q4_0)
3. Enable CPU offloading for some layers
4. Switch to a smaller model

For more help, check the main README.md or open an issue on the project repository.
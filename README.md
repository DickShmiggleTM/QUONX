# QUONX IDE - The Symbiotic Development Environment

QUONX IDE represents a fundamental paradigm shift in software development tooling, evolving from a reactive coding assistant to a truly sentient and symbiotic development environment. This project transforms the existing React web application into a powerful desktop IDE using Tauri, while implementing local-first AI inference and advanced codebase analysis capabilities.

## 🎯 Vision

The QUONX IDE is designed to be a **proactive and predictive partner** that:
- Anticipates developer needs through intent inference
- Simulates the future impact of code changes
- Autonomously evolves the codebase it manages
- Provides deep, real-time understanding of entire software projects

## 🏗️ Architecture Overview

### Core Principles

1. **Local-First Execution**: All AI model inference and deep codebase analysis runs entirely on the user's machine
2. **Developer-Centric Privacy**: No code, project context, or behavioral data is transmitted to external servers
3. **High-Performance Architecture**: Fluid, instantaneous user experience with real-time synchronization

### Technology Stack

- **Desktop Framework**: Tauri (Rust + Web Technologies)
- **Frontend**: React with TypeScript
- **AI Inference**: llama.cpp with Python backend
- **Local Models**: GGUF format with CUDA acceleration support
- **Embeddings**: Local sentence-transformers
- **Code Analysis**: Tree-sitter for AST parsing
- **Graph Database**: FalkorDB for semantic relationships
- **Vector Store**: LanceDB for semantic search

## 🚀 Current Implementation Status

### ✅ Phase 1: Foundation (COMPLETED)
- [x] Tauri desktop application framework
- [x] Local AI inference engine with llama.cpp
- [x] Model management system for GGUF models
- [x] Python backend service with FastAPI
- [x] React frontend integration with Tauri APIs
- [x] File system monitoring and project management

### 🔄 Phase 2: Sentient Codebase (IN PROGRESS)
- [ ] Tree-sitter integration for syntactic analysis
- [ ] FalkorDB semantic layer for code relationships
- [ ] LanceDB vector layer for semantic search
- [ ] Real-time codebase analysis pipeline

### 📋 Phase 3: Agentic Core (PLANNED)
- [ ] Multi-agent architecture (Orchestrator, Chat, Code, Reasoner)
- [ ] Plan-then-ReAct reasoning framework
- [ ] Dynamic tool use system with sandboxed execution
- [ ] Autonomous code modification capabilities

### 🔮 Phase 4: Visionary Features (PLANNED)
- [ ] Intent inference engine for proactive behavior
- [ ] Holistic digital twin and simulation engine
- [ ] Generative self-evolution and optimization
- [ ] Autonomous improvement agents

## 🛠️ Development Setup

### Prerequisites

- **Rust**: Latest stable version with Cargo
- **Node.js**: Version 20+ with npm
- **Python**: Version 3.8+ with pip
- **System Dependencies**: Build tools for native compilation

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd QUONX
   ```

2. **Install Rust and Tauri CLI**:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source $HOME/.cargo/env
   cargo install tauri-cli --version "^2.0.0"
   ```

3. **Install Node.js dependencies**:
   ```bash
   cd QUONX
   npm install
   ```

4. **Install Python dependencies**:
   ```bash
   cd ../ai_engine
   pip install -r requirements.txt
   ```

### Running the Application

1. **Development Mode**:
   ```bash
   cd /path/to/project
   cargo tauri dev
   ```

2. **Build for Production**:
   ```bash
   cargo tauri build
   ```

3. **Run AI Engine Standalone** (for testing):
   ```bash
   cd ai_engine
   python main.py --port 8765 --models-dir ./models
   ```

## 📁 Project Structure

```
QUONX/
├── src-tauri/                 # Tauri Rust backend
│   ├── src/
│   │   ├── main.rs           # Main Tauri application
│   │   ├── lib.rs            # Core application logic
│   │   ├── ai_engine.rs      # AI engine management
│   │   ├── file_watcher.rs   # File system monitoring
│   │   └── project_manager.rs # Project analysis
│   ├── Cargo.toml            # Rust dependencies
│   └── tauri.conf.json       # Tauri configuration
├── QUONX/                     # React frontend
│   ├── src/                  # React components and logic
│   ├── services/             # Service layer
│   │   ├── tauriService.ts   # Tauri API integration
│   │   └── localAIService.ts # Local AI service
│   ├── package.json          # Node.js dependencies
│   └── vite.config.ts        # Vite configuration
├── ai_engine/                 # Python AI backend
│   ├── main.py               # FastAPI server
│   ├── model_manager.py      # GGUF model management
│   ├── inference_engine.py   # llama.cpp integration
│   ├── embeddings_service.py # Local embeddings
│   └── requirements.txt      # Python dependencies
└── models/                    # GGUF model storage (user-provided)
```

## 🤖 AI Engine Features

### Model Management
- **Automatic Discovery**: Scans for GGUF models in the models directory
- **Multi-Model Support**: Different models for different roles (chat, code, reasoning)
- **CUDA Acceleration**: Automatic GPU layer optimization based on available VRAM
- **Graceful Fallback**: CPU inference when GPU is unavailable

### Inference Capabilities
- **Role-Based Models**: Specialized models for different tasks
- **Context Management**: Maintains conversation context and project context
- **Streaming Support**: Real-time response generation
- **Performance Monitoring**: Tracks token usage and processing time

### Local Privacy
- **No External Calls**: All inference happens locally
- **No Data Collection**: No telemetry or usage tracking
- **Secure by Design**: Sandboxed execution environment

## 🔧 Configuration

### Model Setup
1. Create a `models/` directory in the project root
2. Download GGUF models (e.g., from Hugging Face)
3. Place models in the directory
4. The application will automatically discover and load them

### Recommended Models
- **Chat**: Mistral-7B-Instruct or Yi-34B-Chat
- **Code**: CodeLlama-34B or DeepSeek-Coder-33B
- **Reasoning**: Yi-34B-Chat or Phi-2

### Hardware Requirements
- **Minimum**: 8GB RAM, modern CPU
- **Recommended**: 16GB+ RAM, NVIDIA GPU with 8GB+ VRAM
- **Optimal**: 32GB+ RAM, NVIDIA GPU with 24GB+ VRAM

## 🤝 Contributing

This project is in active development. Contributions are welcome in the following areas:

1. **Core Features**: Implementing the remaining phases
2. **Model Integration**: Adding support for new model formats
3. **UI/UX**: Enhancing the developer experience
4. **Performance**: Optimizing inference and analysis speed
5. **Documentation**: Improving setup and usage guides

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **llama.cpp**: For high-performance local LLM inference
- **Tauri**: For the secure, performant desktop framework
- **Tree-sitter**: For incremental parsing capabilities
- **The Open Source Community**: For the foundational technologies that make this vision possible

---

**QUONX IDE** - Redefining the relationship between developer and tool through symbiotic intelligence.
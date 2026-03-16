# CLAUDE.md — QUONX IDE Codebase Guide

This file provides guidance for AI assistants working on the QUONX IDE codebase.

---

## Project Overview

QUONX is a **desktop-based, AI-powered development environment** built with a hybrid stack:

- **Frontend:** React 19 + TypeScript (Vite bundler)
- **Desktop shell:** Tauri 2 (Rust backend)
- **AI inference sidecar:** Python 3 + FastAPI + llama.cpp (local LLMs)

The IDE features multi-agent AI orchestration (Swarm), semantic code analysis (knowledge graph), local LLM inference, Git integration, a plugin system, and a retro green-on-black terminal aesthetic.

---

## Repository Structure

```
QUONX/
├── components/          # 17 React UI components (.tsx)
├── services/            # 11 TypeScript business-logic services (.ts)
├── hooks/               # Custom React hooks (useFileSystem.ts)
├── python_sidecar/      # Python FastAPI AI inference server
│   ├── main.py          # FastAPI app; endpoints: /health /models /inference
│   └── requirements.txt
├── src-tauri/           # Rust Tauri backend
│   ├── src/
│   │   ├── lib.rs           # App state, Tauri command handlers
│   │   ├── main.rs          # Entry point
│   │   ├── python_sidecar.rs# Python subprocess lifecycle
│   │   ├── model_manager.rs # Local GGUF model discovery
│   │   └── file_watcher.rs  # File-system change notifications
│   ├── Cargo.toml
│   └── build.rs
├── App.tsx              # Root React component
├── index.tsx            # React entry point
├── index.html           # HTML shell (Tailwind CDN, import map)
├── types.ts             # Shared TypeScript type definitions
├── vite.config.ts       # Vite config (path alias @/*, GEMINI_API_KEY inject)
├── tsconfig.json        # TypeScript config (target ES2022, strict)
├── tauri.conf.json      # Tauri app config (window, bundler, CSP)
├── package.json         # npm deps and scripts
└── metadata.json        # Project metadata
```

---

## Key Components

| File | Role |
|---|---|
| `components/Editor.tsx` | CodeMirror 6 code editor with language support |
| `components/AIAgentPanel.tsx` | Chat interface for AI agent interaction |
| `components/SwarmPanel.tsx` | Multi-agent swarm orchestration UI |
| `components/FileExplorer.tsx` | Sidebar file/folder navigation |
| `components/Terminal.tsx` | Terminal emulator panel |
| `components/GitPanel.tsx` | Git status/commit/branch UI |
| `components/MemoryPanel.tsx` | Knowledge graph viewer |
| `components/DebuggerPanel.tsx` | Debugger state and breakpoints |
| `components/PluginManagerPanel.tsx` | Plugin install/management UI |

---

## Key Services

| File | Role |
|---|---|
| `services/swarmService.ts` | Orchestrates 7 specialized AI agents (Planner, Designer, CodeAgent, UIAgent, TestingAgent, DocumentAgent, ReviewerAgent) |
| `services/geminiService.ts` | Google Gemini API wrapper for LLM calls |
| `services/codebaseAnalyzer.ts` | Semantic analysis → knowledge graph nodes/edges |
| `services/memoryService.ts` | Knowledge graph persistence and retrieval |
| `services/gitService.ts` | Git operations (commits, branches, merge conflicts) |
| `services/pluginService.ts` | Sandboxed plugin execution via Web Workers |
| `services/intentInferenceEngine.ts` | Classifies user intent to route to correct agent |
| `services/graphDB.ts` | In-memory graph database |
| `services/indexingService.ts` | Code indexing |
| `services/lintingService.ts` | Linting results aggregation |
| `services/debuggerService.ts` | Debugger state management |

---

## Development Workflows

### Prerequisites

- Node.js + npm
- Rust toolchain (1.77.2+)
- Python 3.9+ with pip
- Tauri CLI (`cargo install tauri-cli`)

### Frontend dev server only

```bash
npm run dev        # starts Vite at http://localhost:5175
```

### Full desktop app (frontend + Rust backend)

```bash
cargo tauri dev    # starts Vite dev server AND Rust backend together
```

### Production build

```bash
cargo tauri build  # runs `npm run build` then compiles Rust and packages app
```

### Python sidecar (local LLM inference)

```bash
cd python_sidecar
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Place GGUF model files in `python_sidecar/models/`. The sidecar exposes:
- `GET  /health` — health check
- `GET  /models` — list available models
- `POST /models/load` — load a model
- `POST /inference` — run inference

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | Optional | Enables Google Gemini API in `geminiService.ts` |

Vite injects `GEMINI_API_KEY` from the environment at build/dev time (see `vite.config.ts`).

---

## Testing

There are currently **no test files** in the repository. When adding tests:

- Use Vitest (already available via Vite ecosystem) for TypeScript/React unit tests
- Place test files alongside source files as `*.test.ts` / `*.test.tsx`
- Use `cargo test` for Rust unit tests in `src-tauri/`
- Use `pytest` for Python sidecar tests

---

## Code Conventions

### TypeScript / React

- **PascalCase** for React components and TypeScript classes
- **camelCase** for functions, variables, and hook names
- **UPPER_SNAKE_CASE** for constants
- Naming patterns: `[Feature]Service` for services, `use[Feature]` for hooks
- Import paths must include file extensions (`.ts`, `.tsx`) — enforced by `tsconfig.json`
- Use the `@/` path alias (maps to repo root) for non-relative imports
- All shared types live in `types.ts` — add new shared types there, not in component files
- State is managed locally with `useState`/`useCallback`; services maintain their own state
- No global state manager (Redux, Zustand, etc.) — keep it that way unless complexity demands it

### Rust

- Follow standard Rust idioms; `lib.rs` wires Tauri commands
- All Tauri commands must be registered in the `.invoke_handler()` builder in `lib.rs`
- Use `serde` derive macros for any struct that crosses the Tauri IPC boundary
- Async commands should use `tokio::spawn` or `async fn` with `tauri::async_runtime`

### Python

- FastAPI route handlers in `main.py`; keep them thin, move logic to helper functions
- Use Pydantic models for all request/response schemas
- GGUF models go in the `models/` subdirectory

### General

- Prefer `async/await` over raw Promise chains
- Wrap all Tauri `invoke` calls in try/catch
- Log errors to console; don't swallow them silently
- Keep components focused — extract complex logic into services

---

## Architecture Notes

### Frontend ↔ Rust IPC

Frontend calls Rust via `import { invoke } from "@tauri-apps/api/core"`:

```typescript
const result = await invoke<string>("command_name", { arg1: value });
```

### Swarm Agent System

`swarmService.ts` implements a planner–executor pattern with 7 agent roles. The `IntentInferenceEngine` routes user goals to the correct agent(s). Agents communicate through a shared task queue.

### Knowledge Graph

`codebaseAnalyzer.ts` parses source files and builds a graph of nodes (files, functions, classes) and edges (imports, calls, inheritance) stored in `graphDB.ts`. `memoryService.ts` persists and queries this graph.

### Plugin System

Plugins are loaded and executed inside Web Workers (via `pluginService.ts`) for sandboxing. Plugins expose tools defined in the `Plugin` / `PluginTool` interfaces from `types.ts`.

### UI Aesthetic

The IDE uses a **retro terminal aesthetic**: dark background (`#0a0a0a`), green (`#00ff00` / `#39ff14`) accents, "Press Start 2P" pixel font. Tailwind CSS is loaded via CDN in `index.html`. Match this style in any new UI work.

---

## Important Files for Context

When working on a new feature, always read these files first:

1. `types.ts` — all shared interfaces
2. `App.tsx` — root component wiring
3. The relevant service in `services/`
4. The relevant component in `components/`

---

## Common Pitfalls

- **Import extensions:** Always include `.ts`/`.tsx` in import paths. Missing extensions will cause Vite build errors.
- **Tauri CSP:** `tauri.conf.json` sets CSP to `null` (permissive). Tighten this before shipping to production.
- **Virtual file system:** `useFileSystem.ts` manages an **in-memory** file tree; it does not write to disk unless routed through Tauri `invoke` commands.
- **Gemini API key:** Without `GEMINI_API_KEY`, `geminiService.ts` calls will fail silently or throw. Guard calls appropriately.
- **Python sidecar:** The Rust `python_sidecar.rs` module manages the Python subprocess lifetime. It must be running for local LLM inference to work.
- **No CI:** There is no CI pipeline yet. All checks must be run locally before pushing.

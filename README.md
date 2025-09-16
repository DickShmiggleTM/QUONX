<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Quonx IDE

Quonx IDE is a next-generation, AI-powered development environment designed to be a "sentient" partner in your coding workflow. It combines a familiar IDE interface with a powerful swarm of AI agents that can understand your goals, create plans, and execute complex software development tasks.

## Features

- **File Explorer & Editor**: A classic file explorer and a text editor for writing and editing code.
- **AI Agent Panel**: Interact with a powerful AI agent that can answer questions, generate code, and more.
- **Swarm Intelligence**: Assign complex tasks to a swarm of specialized AI agents that work together to achieve your goals.
- **Knowledge Graph**: A semantic understanding of your codebase, enabling powerful features like code search and analysis.
- **Plugin System**: Extend the IDE's capabilities with custom plugins.
- **Integrated Terminal**: A built-in terminal for running commands.
- **Git Integration**: Manage your source control directly within the IDE.

## Architecture

Quonx IDE is a Tauri application, which means it has a Rust backend and a web-based frontend.

- **Frontend**: The frontend is built with React, TypeScript, and Tailwind CSS. It provides the user interface and interacts with the backend via Tauri's API.
- **Backend (Rust/Tauri)**: The backend is written in Rust and uses the Tauri framework. It manages the application window, handles file system operations, and communicates with the Python sidecar.
- **Python Sidecar**: The Python sidecar is a FastAPI server that uses `llama-cpp-python` to run local AI models for inference.

## Setup

To run Quonx IDE locally, you'll need to have the following prerequisites installed:

- **Node.js**: For running the frontend.
- **Rust**: For building the backend.
- **Python**: For running the AI sidecar.

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/your-username/quonx-ide.git
    cd quonx-ide
    ```

2.  **Install frontend dependencies**:
    ```bash
    npm install
    ```

3.  **Install Python dependencies**:
    ```bash
    pip install -r python_sidecar/requirements.txt
    ```

4.  **Set up environment variables**:
    Create a `.env` file in the root of the project and add your Gemini API key:
    ```
    GEMINI_API_KEY=your_api_key
    ```

5.  **Download AI models**:
    Download your desired GGUF-formatted AI models and place them in the `models` directory.

### Running the Application

To run the application in development mode, use the following command:

```bash
npm run tauri dev
```

This will start the frontend development server, the Rust backend, and the Python sidecar.

## Usage

- **File Explorer**: Browse your project files on the left-hand side.
- **Editor**: Click on a file to open it in the editor.
- **AI Agent**: Use the AI Agent panel to ask questions about your code, generate new code, and more.
- **Swarm Panel**: Give the swarm a high-level goal, and watch as it creates a plan and executes it.
- **Settings**: Configure the AI models, performance settings, and other options in the Settings panel.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue.

## License

This project is licensed under the MIT License. See the `LICENSE` file for more details.

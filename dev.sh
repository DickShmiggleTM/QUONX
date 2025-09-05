#!/bin/bash

# QUONX IDE Development Script
# This script helps with common development tasks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[QUONX]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[QUONX]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[QUONX]${NC} $1"
}

print_error() {
    echo -e "${RED}[QUONX]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "src-tauri/Cargo.toml" ]; then
    print_error "Please run this script from the QUONX project root directory"
    exit 1
fi

# Function to check dependencies
check_dependencies() {
    print_status "Checking dependencies..."
    
    # Check Rust
    if ! command -v cargo &> /dev/null; then
        print_error "Rust/Cargo not found. Please install Rust first."
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js not found. Please install Node.js first."
        exit 1
    fi
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 not found. Please install Python 3 first."
        exit 1
    fi
    
    # Check Tauri CLI
    if ! command -v cargo-tauri &> /dev/null; then
        print_warning "Tauri CLI not found. Installing..."
        cargo install tauri-cli --version "^2.0.0"
    fi
    
    print_success "All dependencies found!"
}

# Function to install dependencies
install_deps() {
    print_status "Installing dependencies..."
    
    # Install Node.js dependencies
    print_status "Installing Node.js dependencies..."
    cd QUONX
    npm install
    cd ..
    
    # Install Python dependencies
    print_status "Installing Python dependencies..."
    cd ai_engine
    pip install -r requirements.txt
    cd ..
    
    print_success "Dependencies installed!"
}

# Function to run the AI engine standalone
run_ai_engine() {
    print_status "Starting AI Engine..."
    cd ai_engine
    python main.py --port 8765 --models-dir ../models --log-level INFO
}

# Function to run the full application in development mode
run_dev() {
    print_status "Starting QUONX IDE in development mode..."
    
    # Ensure Rust environment is loaded
    source $HOME/.cargo/env 2>/dev/null || true
    
    # Run Tauri dev
    cargo tauri dev
}

# Function to build the application
build_app() {
    print_status "Building QUONX IDE..."
    
    # Ensure Rust environment is loaded
    source $HOME/.cargo/env 2>/dev/null || true
    
    # Build the application
    cargo tauri build
    
    print_success "Build complete! Check src-tauri/target/release/bundle/ for the installer."
}

# Function to clean build artifacts
clean() {
    print_status "Cleaning build artifacts..."
    
    # Clean Rust artifacts
    cd src-tauri
    cargo clean
    cd ..
    
    # Clean Node.js artifacts
    cd QUONX
    rm -rf node_modules dist
    cd ..
    
    # Clean Python cache
    find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find . -name "*.pyc" -delete 2>/dev/null || true
    
    print_success "Clean complete!"
}

# Function to show help
show_help() {
    echo "QUONX IDE Development Script"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  check       Check if all dependencies are installed"
    echo "  install     Install all project dependencies"
    echo "  dev         Run the application in development mode"
    echo "  ai-engine   Run the AI engine standalone for testing"
    echo "  build       Build the application for production"
    echo "  clean       Clean all build artifacts"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 check           # Check dependencies"
    echo "  $0 install         # Install dependencies"
    echo "  $0 dev             # Start development server"
    echo "  $0 build           # Build for production"
}

# Main script logic
case "${1:-help}" in
    "check")
        check_dependencies
        ;;
    "install")
        check_dependencies
        install_deps
        ;;
    "dev")
        check_dependencies
        run_dev
        ;;
    "ai-engine")
        run_ai_engine
        ;;
    "build")
        check_dependencies
        build_app
        ;;
    "clean")
        clean
        ;;
    "help"|*)
        show_help
        ;;
esac
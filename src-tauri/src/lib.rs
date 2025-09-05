use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::process::{Command, Stdio};
use std::time::Duration;

use anyhow::Result;
use log::{info, warn, error};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State, Window};
use tokio::sync::mpsc;
use tokio::time::sleep;

mod ai_engine;
mod file_watcher;
mod project_manager;

use ai_engine::AIEngineManager;
use file_watcher::FileWatcher;
use project_manager::ProjectManager;

// Application state structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectState {
    pub root_path: Option<PathBuf>,
    pub open_files: Vec<PathBuf>,
    pub active_file: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIEngineState {
    pub is_running: bool,
    pub port: u16,
    pub available_models: Vec<String>,
    pub active_models: HashMap<String, String>, // role -> model_name
}

// Shared application state
pub struct AppState {
    pub project: Arc<Mutex<ProjectState>>,
    pub ai_engine: Arc<Mutex<AIEngineState>>,
    pub ai_manager: Arc<Mutex<Option<AIEngineManager>>>,
    pub file_watcher: Arc<Mutex<Option<FileWatcher>>>,
    pub project_manager: Arc<Mutex<ProjectManager>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            project: Arc::new(Mutex::new(ProjectState {
                root_path: None,
                open_files: Vec::new(),
                active_file: None,
            })),
            ai_engine: Arc::new(Mutex::new(AIEngineState {
                is_running: false,
                port: 8765,
                available_models: Vec::new(),
                active_models: HashMap::new(),
            })),
            ai_manager: Arc::new(Mutex::new(None)),
            file_watcher: Arc::new(Mutex::new(None)),
            project_manager: Arc::new(Mutex::new(ProjectManager::new())),
        }
    }
}

// Tauri commands
#[tauri::command]
async fn initialize_ai_engine(
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<bool, String> {
    info!("Initializing AI engine...");
    
    let mut ai_manager_guard = state.ai_manager.lock().unwrap();
    if ai_manager_guard.is_none() {
        let manager = AIEngineManager::new(app_handle.clone())
            .map_err(|e| format!("Failed to create AI engine manager: {}", e))?;
        *ai_manager_guard = Some(manager);
    }
    
    if let Some(manager) = ai_manager_guard.as_mut() {
        match manager.start().await {
            Ok(port) => {
                let mut ai_state = state.ai_engine.lock().unwrap();
                ai_state.is_running = true;
                ai_state.port = port;
                info!("AI engine started on port {}", port);
                Ok(true)
            }
            Err(e) => {
                error!("Failed to start AI engine: {}", e);
                Err(format!("Failed to start AI engine: {}", e))
            }
        }
    } else {
        Err("AI engine manager not initialized".to_string())
    }
}

#[tauri::command]
async fn shutdown_ai_engine(state: State<'_, AppState>) -> Result<bool, String> {
    info!("Shutting down AI engine...");
    
    let mut ai_manager_guard = state.ai_manager.lock().unwrap();
    if let Some(manager) = ai_manager_guard.as_mut() {
        match manager.stop().await {
            Ok(_) => {
                let mut ai_state = state.ai_engine.lock().unwrap();
                ai_state.is_running = false;
                info!("AI engine stopped");
                Ok(true)
            }
            Err(e) => {
                error!("Failed to stop AI engine: {}", e);
                Err(format!("Failed to stop AI engine: {}", e))
            }
        }
    } else {
        Ok(true) // Already stopped
    }
}

#[tauri::command]
async fn open_project(
    path: String,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<bool, String> {
    info!("Opening project: {}", path);
    
    let project_path = PathBuf::from(path);
    if !project_path.exists() || !project_path.is_dir() {
        return Err("Invalid project path".to_string());
    }
    
    // Update project state
    {
        let mut project_state = state.project.lock().unwrap();
        project_state.root_path = Some(project_path.clone());
        project_state.open_files.clear();
        project_state.active_file = None;
    }
    
    // Initialize file watcher
    {
        let mut watcher_guard = state.file_watcher.lock().unwrap();
        let watcher = FileWatcher::new(project_path.clone(), app_handle.clone())
            .map_err(|e| format!("Failed to create file watcher: {}", e))?;
        *watcher_guard = Some(watcher);
    }
    
    // Initialize project manager
    {
        let mut pm = state.project_manager.lock().unwrap();
        pm.set_root_path(project_path);
    }
    
    Ok(true)
}

#[tauri::command]
async fn get_project_state(state: State<'_, AppState>) -> Result<ProjectState, String> {
    let project_state = state.project.lock().unwrap();
    Ok(project_state.clone())
}

#[tauri::command]
async fn get_ai_engine_state(state: State<'_, AppState>) -> Result<AIEngineState, String> {
    let ai_state = state.ai_engine.lock().unwrap();
    Ok(ai_state.clone())
}

#[tauri::command]
async fn send_ai_request(
    message: String,
    role: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let ai_manager_guard = state.ai_manager.lock().unwrap();
    if let Some(manager) = ai_manager_guard.as_ref() {
        manager.send_request(message, role).await
            .map_err(|e| format!("AI request failed: {}", e))
    } else {
        Err("AI engine not initialized".to_string())
    }
}

#[tauri::command]
async fn list_available_models(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let ai_manager_guard = state.ai_manager.lock().unwrap();
    if let Some(manager) = ai_manager_guard.as_ref() {
        manager.list_models().await
            .map_err(|e| format!("Failed to list models: {}", e))
    } else {
        Err("AI engine not initialized".to_string())
    }
}

#[tauri::command]
async fn set_model_for_role(
    role: String,
    model: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let ai_manager_guard = state.ai_manager.lock().unwrap();
    if let Some(manager) = ai_manager_guard.as_ref() {
        match manager.set_model_for_role(role.clone(), model.clone()).await {
            Ok(_) => {
                let mut ai_state = state.ai_engine.lock().unwrap();
                ai_state.active_models.insert(role, model);
                Ok(true)
            }
            Err(e) => Err(format!("Failed to set model: {}", e))
        }
    } else {
        Err("AI engine not initialized".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    env_logger::Builder::from_default_env()
        .filter_level(log::LevelFilter::Info)
        .init();

    info!("Starting QUONX IDE...");

    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            info!("QUONX IDE setup complete");
            
            // Initialize AI engine on startup
            let app_handle = app.handle().clone();
            let state = app.state::<AppState>();
            
            tauri::async_runtime::spawn(async move {
                // Wait a bit for the app to fully initialize
                sleep(Duration::from_secs(2)).await;
                
                if let Err(e) = initialize_ai_engine(state, app_handle).await {
                    error!("Failed to initialize AI engine on startup: {}", e);
                }
            });
            
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                info!("Application closing, cleaning up...");
                
                // Cleanup AI engine
                let state = window.state::<AppState>();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = shutdown_ai_engine(state).await {
                        error!("Failed to shutdown AI engine: {}", e);
                    }
                });
            }
        })
        .invoke_handler(tauri::generate_handler![
            initialize_ai_engine,
            shutdown_ai_engine,
            open_project,
            get_project_state,
            get_ai_engine_state,
            send_ai_request,
            list_available_models,
            set_model_for_role
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

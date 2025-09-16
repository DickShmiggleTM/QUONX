//! The main library for the Quonx application.
//!
//! This crate is responsible for initializing the Tauri application, setting up
//! the application state, managing plugins, and handling inter-process
//! communication with the frontend.

use tauri::{Manager, State};
use std::sync::Arc;
use tokio::sync::Mutex;

mod file_watcher;
mod python_sidecar;
mod model_manager;

use file_watcher::FileWatcher;
use python_sidecar::PythonSidecar;
use model_manager::ModelManager;

/// Represents the shared state of the application.
///
/// This struct holds all the major components of the application that need to
/// be accessed from different parts of the code, such as the file watcher,
/// the Python sidecar, and the model manager.
#[derive(Debug)]
pub struct AppState {
    /// The file watcher instance, responsible for monitoring file system events.
    pub file_watcher: Arc<Mutex<FileWatcher>>,
    /// The Python sidecar instance, used for running AI models.
    pub python_sidecar: Arc<Mutex<PythonSidecar>>,
    /// The model manager instance, responsible for managing AI models.
    pub model_manager: Arc<Mutex<ModelManager>>,
}

/// The main entry point for the mobile version of the application.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  //! Initializes and runs the Tauri application.
  //!
  //! This function sets up the Tauri application builder, initializes plugins,
  //! creates the application state, and starts the Python sidecar. It also
  //! defines the `invoke_handler` for handling commands from the frontend.
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_process::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Initialize application state
      let app_state = AppState {
        file_watcher: Arc::new(Mutex::new(FileWatcher::new())),
        python_sidecar: Arc::new(Mutex::new(PythonSidecar::new())),
        model_manager: Arc::new(Mutex::new(ModelManager::new())),
      };

      app.manage(app_state);

      // Start the Python sidecar
      let app_handle = app.handle().clone();
      tauri::async_runtime::spawn(async move {
        if let Err(e) = start_python_sidecar(app_handle).await {
          log::error!("Failed to start Python sidecar: {}", e);
        }
      });

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      get_project_files,
      watch_directory,
      get_available_models,
      start_ai_inference
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

/// Starts the Python sidecar process.
///
/// This function retrieves the `PythonSidecar` instance from the application
/// state and calls its `start` method to launch the sidecar process.
///
/// # Arguments
///
/// * `app_handle` - A handle to the Tauri application.
///
/// # Returns
///
/// * `Result<(), Box<dyn std::error::Error>>` - An empty result if the sidecar
///   starts successfully, or an error otherwise.
async fn start_python_sidecar(app_handle: tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
  let state: State<AppState> = app_handle.state();
  let mut sidecar = state.python_sidecar.lock().await;
  sidecar.start().await?;
  Ok(())
}

/// Retrieves a list of files in the specified project directory.
///
/// # Arguments
///
/// * `_path` - The path to the project directory.
///
/// # Returns
///
/// * `Result<Vec<String>, String>` - A list of file paths, or an error message.
#[tauri::command]
async fn get_project_files(_path: String) -> Result<Vec<String>, String> {
  // Implementation for getting project files
  Ok(vec![])
}

/// Starts watching a directory for changes.
///
/// # Arguments
///
/// * `_path` - The path to the directory to watch.
///
/// # Returns
///
/// * `Result<(), String>` - An empty result on success, or an error message.
#[tauri::command]
async fn watch_directory(_path: String) -> Result<(), String> {
  // Implementation for watching directory
  Ok(())
}

/// Retrieves a list of available AI models.
///
/// # Returns
///
/// * `Result<Vec<String>, String>` - A list of model names, or an error message.
#[tauri::command]
async fn get_available_models() -> Result<Vec<String>, String> {
  // Implementation for getting available models
  Ok(vec![])
}

/// Starts an AI inference task.
///
/// # Arguments
///
/// * `_prompt` - The prompt to send to the AI model.
/// * `_model` - The name of the model to use for inference.
///
/// # Returns
///
/// * `Result<String, String>` - The AI-generated response, or an error message.
#[tauri::command]
async fn start_ai_inference(_prompt: String, _model: String) -> Result<String, String> {
  // Implementation for AI inference
  Ok("AI response".to_string())
}

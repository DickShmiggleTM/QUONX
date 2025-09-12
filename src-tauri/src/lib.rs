use tauri::{Manager, State};
use std::sync::Arc;
use tokio::sync::Mutex;

mod file_watcher;
mod python_sidecar;
mod model_manager;

use file_watcher::FileWatcher;
use python_sidecar::PythonSidecar;
use model_manager::ModelManager;

#[derive(Debug)]
pub struct AppState {
    pub file_watcher: Arc<Mutex<FileWatcher>>,
    pub python_sidecar: Arc<Mutex<PythonSidecar>>,
    pub model_manager: Arc<Mutex<ModelManager>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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

async fn start_python_sidecar(app_handle: tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
  let state: State<AppState> = app_handle.state();
  let mut sidecar = state.python_sidecar.lock().await;
  sidecar.start().await?;
  Ok(())
}

#[tauri::command]
async fn get_project_files(_path: String) -> Result<Vec<String>, String> {
  // Implementation for getting project files
  Ok(vec![])
}

#[tauri::command]
async fn watch_directory(_path: String) -> Result<(), String> {
  // Implementation for watching directory
  Ok(())
}

#[tauri::command]
async fn get_available_models() -> Result<Vec<String>, String> {
  // Implementation for getting available models
  Ok(vec![])
}

#[tauri::command]
async fn start_ai_inference(_prompt: String, _model: String) -> Result<String, String> {
  // Implementation for AI inference
  Ok("AI response".to_string())
}

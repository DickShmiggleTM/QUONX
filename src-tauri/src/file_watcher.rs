use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

use anyhow::Result;
use log::{info, warn, error, debug};
use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChangeEvent {
    pub path: PathBuf,
    pub event_type: String,
    pub timestamp: u64,
}

pub struct FileWatcher {
    _watcher: RecommendedWatcher,
    _handle: thread::JoinHandle<()>,
}

impl FileWatcher {
    pub fn new(project_path: PathBuf, app_handle: AppHandle) -> Result<Self> {
        let (tx, rx) = mpsc::channel();

        // Create the watcher
        let mut watcher = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                match res {
                    Ok(event) => {
                        if let Err(e) = tx.send(event) {
                            error!("Failed to send file event: {}", e);
                        }
                    }
                    Err(e) => error!("File watcher error: {}", e),
                }
            },
            Config::default(),
        )?;

        // Watch the project directory
        watcher.watch(&project_path, RecursiveMode::Recursive)?;
        info!("Started watching directory: {}", project_path.display());

        // Spawn a thread to handle file events
        let handle = thread::spawn(move || {
            Self::handle_events(rx, app_handle, project_path);
        });

        Ok(Self {
            _watcher: watcher,
            _handle: handle,
        })
    }

    fn handle_events(
        rx: mpsc::Receiver<Event>,
        app_handle: AppHandle,
        project_path: PathBuf,
    ) {
        for event in rx {
            if let Err(e) = Self::process_event(event, &app_handle, &project_path) {
                error!("Failed to process file event: {}", e);
            }
        }
    }

    fn process_event(
        event: Event,
        app_handle: &AppHandle,
        project_path: &Path,
    ) -> Result<()> {
        debug!("File event: {:?}", event);

        // Filter out events we don't care about
        if Self::should_ignore_event(&event, project_path) {
            return Ok(());
        }

        let event_type = match event.kind {
            EventKind::Create(_) => "created",
            EventKind::Modify(_) => "modified",
            EventKind::Remove(_) => "deleted",
            EventKind::Access(_) => "accessed",
            _ => "other",
        };

        // Process each path in the event
        for path in event.paths {
            if let Ok(relative_path) = path.strip_prefix(project_path) {
                let file_event = FileChangeEvent {
                    path: relative_path.to_path_buf(),
                    event_type: event_type.to_string(),
                    timestamp: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs(),
                };

                // Emit the event to the frontend
                if let Err(e) = app_handle.emit("file-changed", &file_event) {
                    error!("Failed to emit file change event: {}", e);
                }

                // Trigger codebase analysis for code files
                if Self::is_code_file(&path) && event_type != "deleted" {
                    if let Err(e) = Self::trigger_analysis(&path, app_handle) {
                        warn!("Failed to trigger analysis for {}: {}", path.display(), e);
                    }
                }
            }
        }

        Ok(())
    }

    fn should_ignore_event(event: &Event, project_path: &Path) -> bool {
        // Ignore events for temporary files, hidden files, and build artifacts
        for path in &event.paths {
            if let Ok(relative_path) = path.strip_prefix(project_path) {
                let path_str = relative_path.to_string_lossy();
                
                // Ignore hidden files and directories
                if path_str.starts_with('.') {
                    return true;
                }
                
                // Ignore common build/cache directories
                if path_str.contains("node_modules") ||
                   path_str.contains("target") ||
                   path_str.contains("dist") ||
                   path_str.contains("build") ||
                   path_str.contains(".git") ||
                   path_str.contains("__pycache__") {
                    return true;
                }
                
                // Ignore temporary files
                if path_str.ends_with(".tmp") ||
                   path_str.ends_with(".swp") ||
                   path_str.ends_with("~") {
                    return true;
                }
            }
        }
        
        false
    }

    fn is_code_file(path: &Path) -> bool {
        if let Some(extension) = path.extension() {
            let ext = extension.to_string_lossy().to_lowercase();
            matches!(ext.as_str(),
                "rs" | "py" | "js" | "ts" | "jsx" | "tsx" | "java" | "cpp" | "c" | "h" |
                "go" | "php" | "rb" | "swift" | "kt" | "scala" | "cs" | "vb" | "sql" |
                "html" | "css" | "scss" | "sass" | "less" | "vue" | "svelte" | "json" |
                "yaml" | "yml" | "toml" | "xml" | "md" | "txt" | "sh" | "bat" | "ps1"
            )
        } else {
            false
        }
    }

    fn trigger_analysis(path: &Path, app_handle: &AppHandle) -> Result<()> {
        // Emit an event to trigger codebase analysis
        let analysis_event = serde_json::json!({
            "type": "analyze_file",
            "path": path.to_string_lossy(),
            "timestamp": std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs()
        });

        app_handle.emit("trigger-analysis", analysis_event)?;
        Ok(())
    }
}
//! This module provides file system watching capabilities.
//!
//! It uses the `notify` crate to monitor a directory for changes and sends
//! events to the rest of the application when files are created, modified,
//! deleted, or renamed.

use notify::{Watcher, RecursiveMode, Event, EventKind};
use std::path::Path;
use std::sync::mpsc;
use tokio::sync::mpsc as tokio_mpsc;
use log::{info, error};

/// The main struct for watching file system events.
///
/// It holds an optional `notify::RecommendedWatcher` and a sender for
/// `FileEvent`s.
#[derive(Debug)]
pub struct FileWatcher {
    /// The underlying file watcher from the `notify` crate.
    watcher: Option<notify::RecommendedWatcher>,
    /// The sender for sending file events to the application.
    event_sender: Option<tokio_mpsc::UnboundedSender<FileEvent>>,
}

/// Represents a file system event.
///
/// It contains the path of the file that was changed and the type of event.
#[derive(Debug, Clone)]
pub struct FileEvent {
    /// The path of the file or directory that the event occurred on.
    pub path: String,
    /// The type of file event.
    pub event_type: FileEventType,
}

/// An enum representing the different types of file events.
#[derive(Debug, Clone)]
pub enum FileEventType {
    /// A new file or directory was created.
    Created,
    /// A file or directory was modified.
    Modified,
    /// A file or directory was deleted.
    Deleted,
    /// A file or directory was renamed.
    Renamed,
}

impl FileWatcher {
    /// Creates a new `FileWatcher` instance.
    ///
    /// # Returns
    ///
    /// * `Self` - A new `FileWatcher` instance with `watcher` and
    ///   `event_sender` set to `None`.
    pub fn new() -> Self {
        Self {
            watcher: None,
            event_sender: None,
        }
    }

    /// Starts watching a directory for changes.
    ///
    /// This method initializes a new file watcher and starts monitoring the
    /// specified path. It returns a `tokio_mpsc::UnboundedReceiver` that
    /// can be used to receive `FileEvent`s.
    ///
    /// # Arguments
    ///
    /// * `path` - The path to the directory to watch.
    ///
    /// # Returns
    ///
    /// * `Result<tokio_mpsc::UnboundedReceiver<FileEvent>, Box<dyn std::error::Error>>` -
    ///   A receiver for `FileEvent`s on success, or an error otherwise.
    pub async fn start_watching(&mut self, path: &str) -> Result<tokio_mpsc::UnboundedReceiver<FileEvent>, Box<dyn std::error::Error>> {
        let (tx, rx) = tokio_mpsc::unbounded_channel();
        self.event_sender = Some(tx.clone());

        let (sync_tx, sync_rx) = mpsc::channel();
        
        let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
            match res {
                Ok(event) => {
                    if let Err(e) = sync_tx.send(event) {
                        error!("Failed to send file event: {}", e);
                    }
                }
                Err(e) => error!("File watcher error: {}", e),
            }
        })?;

        watcher.watch(Path::new(path), RecursiveMode::Recursive)?;
        self.watcher = Some(watcher);

        // Spawn task to process file events
        let tx_clone = tx.clone();
        tokio::spawn(async move {
            while let Ok(event) = sync_rx.recv() {
                for path in event.paths {
                    let event_type = match event.kind {
                        EventKind::Create(_) => FileEventType::Created,
                        EventKind::Modify(_) => FileEventType::Modified,
                        EventKind::Remove(_) => FileEventType::Deleted,
                        EventKind::Other => FileEventType::Renamed,
                        _ => continue,
                    };

                    let file_event = FileEvent {
                        path: path.to_string_lossy().to_string(),
                        event_type,
                    };

                    if let Err(e) = tx_clone.send(file_event) {
                        error!("Failed to send file event to async channel: {}", e);
                        break;
                    }
                }
            }
        });

        info!("Started watching directory: {}", path);
        Ok(rx)
    }

    /// Stops watching for file changes.
    ///
    /// This method sets the `watcher` and `event_sender` to `None`, effectively
    /// stopping the file watcher.
    pub fn stop_watching(&mut self) {
        self.watcher = None;
        self.event_sender = None;
        info!("Stopped file watcher");
    }
}
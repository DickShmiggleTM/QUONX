// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// The main entry point for the Quonx application.
///
/// This function initializes and runs the Tauri application by calling
/// the `run` function from the `app_lib` crate.
fn main() {
  app_lib::run();
}

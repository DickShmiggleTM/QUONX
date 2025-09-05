use std::collections::HashMap;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::time::Duration;

use anyhow::{anyhow, Result};
use log::{info, warn, error, debug};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tokio::time::{sleep, timeout};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIRequest {
    pub message: String,
    pub role: String,
    pub context: Option<String>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIResponse {
    pub response: String,
    pub model: String,
    pub tokens_used: Option<u32>,
    pub processing_time: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub name: String,
    pub size: String,
    pub quantization: String,
    pub context_length: u32,
    pub is_loaded: bool,
}

pub struct AIEngineManager {
    app_handle: AppHandle,
    process: Option<Child>,
    port: u16,
    client: Client,
    models_dir: PathBuf,
    active_models: HashMap<String, String>, // role -> model_name
}

impl AIEngineManager {
    pub fn new(app_handle: AppHandle) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(300)) // 5 minute timeout for model loading
            .build()?;

        // Get the app data directory for storing models
        let app_data_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| anyhow!("Failed to get app data directory: {}", e))?;
        
        let models_dir = app_data_dir.join("models");
        std::fs::create_dir_all(&models_dir)?;

        Ok(Self {
            app_handle,
            process: None,
            port: 8765,
            client,
            models_dir,
            active_models: HashMap::new(),
        })
    }

    pub async fn start(&mut self) -> Result<u16> {
        if self.process.is_some() {
            return Ok(self.port);
        }

        info!("Starting AI engine on port {}", self.port);

        // Get the path to the AI engine binary
        let ai_engine_path = self.get_ai_engine_path()?;
        
        // Start the AI engine process
        let mut cmd = Command::new(&ai_engine_path);
        cmd.arg("--port")
            .arg(self.port.to_string())
            .arg("--models-dir")
            .arg(&self.models_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let child = cmd.spawn()
            .map_err(|e| anyhow!("Failed to start AI engine: {}", e))?;

        self.process = Some(child);

        // Wait for the engine to be ready
        self.wait_for_ready().await?;

        info!("AI engine started successfully on port {}", self.port);
        Ok(self.port)
    }

    pub async fn stop(&mut self) -> Result<()> {
        if let Some(mut process) = self.process.take() {
            info!("Stopping AI engine...");
            
            // Try graceful shutdown first
            if let Err(e) = self.send_shutdown_request().await {
                warn!("Graceful shutdown failed: {}, forcing termination", e);
                process.kill()?;
            }
            
            // Wait for process to exit
            let _ = process.wait()?;
            info!("AI engine stopped");
        }
        Ok(())
    }

    pub async fn send_request(&self, message: String, role: String) -> Result<String> {
        if self.process.is_none() {
            return Err(anyhow!("AI engine not running"));
        }

        let model = self.active_models.get(&role)
            .ok_or_else(|| anyhow!("No model configured for role: {}", role))?;

        let request = AIRequest {
            message,
            role: role.clone(),
            context: None,
            temperature: Some(0.7),
            max_tokens: Some(2048),
        };

        let url = format!("http://localhost:{}/generate", self.port);
        let response = self.client
            .post(&url)
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("AI request failed: {}", error_text));
        }

        let ai_response: AIResponse = response.json().await?;
        Ok(ai_response.response)
    }

    pub async fn list_models(&self) -> Result<Vec<String>> {
        if self.process.is_none() {
            return Err(anyhow!("AI engine not running"));
        }

        let url = format!("http://localhost:{}/models", self.port);
        let response = self.client.get(&url).send().await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("Failed to list models: {}", error_text));
        }

        let models: Vec<ModelInfo> = response.json().await?;
        Ok(models.into_iter().map(|m| m.name).collect())
    }

    pub async fn set_model_for_role(&mut self, role: String, model: String) -> Result<()> {
        if self.process.is_none() {
            return Err(anyhow!("AI engine not running"));
        }

        // Load the model if not already loaded
        let url = format!("http://localhost:{}/load_model", self.port);
        let request = serde_json::json!({
            "model": model,
            "role": role
        });

        let response = self.client
            .post(&url)
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("Failed to load model: {}", error_text));
        }

        self.active_models.insert(role, model);
        Ok(())
    }

    async fn wait_for_ready(&self) -> Result<()> {
        let url = format!("http://localhost:{}/health", self.port);
        let max_attempts = 30;
        let delay = Duration::from_secs(2);

        for attempt in 1..=max_attempts {
            debug!("Health check attempt {}/{}", attempt, max_attempts);
            
            match self.client.get(&url).send().await {
                Ok(response) if response.status().is_success() => {
                    info!("AI engine is ready");
                    return Ok(());
                }
                Ok(response) => {
                    debug!("Health check failed with status: {}", response.status());
                }
                Err(e) => {
                    debug!("Health check failed: {}", e);
                }
            }

            if attempt < max_attempts {
                sleep(delay).await;
            }
        }

        Err(anyhow!("AI engine failed to start within timeout"))
    }

    async fn send_shutdown_request(&self) -> Result<()> {
        let url = format!("http://localhost:{}/shutdown", self.port);
        let response = timeout(
            Duration::from_secs(5),
            self.client.post(&url).send()
        ).await??;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(anyhow!("Shutdown request failed"))
        }
    }

    fn get_ai_engine_path(&self) -> Result<PathBuf> {
        // In development, look for the Python script
        // In production, look for the bundled executable
        
        let resource_dir = self.app_handle
            .path()
            .resource_dir()
            .map_err(|e| anyhow!("Failed to get resource directory: {}", e))?;

        // Try bundled executable first
        let exe_path = resource_dir.join("binaries").join("quonx-ai-engine");
        if exe_path.exists() {
            return Ok(exe_path);
        }

        // Fallback to Python script for development
        let script_path = resource_dir.join("ai_engine").join("main.py");
        if script_path.exists() {
            return Ok(script_path);
        }

        // Last resort: look in the current directory
        let local_script = PathBuf::from("ai_engine/main.py");
        if local_script.exists() {
            return Ok(local_script);
        }

        Err(anyhow!("AI engine binary not found"))
    }
}

impl Drop for AIEngineManager {
    fn drop(&mut self) {
        if let Some(mut process) = self.process.take() {
            warn!("AI engine manager dropped, forcefully terminating process");
            let _ = process.kill();
        }
    }
}
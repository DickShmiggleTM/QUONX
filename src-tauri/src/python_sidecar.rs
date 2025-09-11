use std::process::Stdio;
use std::path::Path;
use log::{info, error, warn};
use serde::{Deserialize, Serialize};
use tokio::process::Command as TokioCommand;

#[derive(Debug, Serialize, Deserialize)]
pub struct InferenceRequest {
    pub prompt: String,
    pub model: String,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InferenceResponse {
    pub response: String,
    pub tokens_used: Option<u32>,
    pub model_used: String,
}

#[derive(Debug)]
pub struct PythonSidecar {
    process: Option<tokio::process::Child>,
    port: u16,
}

impl PythonSidecar {
    pub fn new() -> Self {
        Self {
            process: None,
            port: 8000,
        }
    }

    pub async fn start(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        // Check if Python sidecar script exists
        let sidecar_script = "python_sidecar/main.py";
        if !Path::new(sidecar_script).exists() {
            warn!("Python sidecar script not found at {}", sidecar_script);
            return Ok(());
        }

        // Start the Python FastAPI server
        let mut cmd = TokioCommand::new("python");
        cmd.arg(sidecar_script)
           .arg("--port")
           .arg(self.port.to_string())
           .stdout(Stdio::piped())
           .stderr(Stdio::piped());

        let child = cmd.spawn()?;
        self.process = Some(child);

        info!("Started Python sidecar on port {}", self.port);
        Ok(())
    }

    pub async fn stop(&mut self) {
        if let Some(mut process) = self.process.take() {
            if let Err(e) = process.kill().await {
                error!("Failed to kill Python sidecar: {}", e);
            } else {
                info!("Stopped Python sidecar");
            }
        }
    }

    pub async fn is_running(&mut self) -> bool {
        if let Some(process) = &mut self.process {
            process.try_wait().map(|status| status.is_none()).unwrap_or(false)
        } else {
            false
        }
    }

    pub async fn health_check(&self) -> Result<bool, Box<dyn std::error::Error>> {
        let client = reqwest::Client::new();
        let url = format!("http://localhost:{}/health", self.port);
        
        match client.get(&url).timeout(std::time::Duration::from_secs(5)).send().await {
            Ok(response) => Ok(response.status().is_success()),
            Err(_) => Ok(false),
        }
    }

    pub async fn inference(&self, request: InferenceRequest) -> Result<InferenceResponse, Box<dyn std::error::Error>> {
        let client = reqwest::Client::new();
        let url = format!("http://localhost:{}/inference", self.port);
        
        let response = client
            .post(&url)
            .json(&request)
            .timeout(std::time::Duration::from_secs(30))
            .send()
            .await?;

        if response.status().is_success() {
            let inference_response: InferenceResponse = response.json().await?;
            Ok(inference_response)
        } else {
            Err(format!("Inference request failed with status: {}", response.status()).into())
        }
    }

    pub fn get_port(&self) -> u16 {
        self.port
    }
}

impl Drop for PythonSidecar {
    fn drop(&mut self) {
        if let Some(mut process) = self.process.take() {
            let _ = process.kill();
        }
    }
}
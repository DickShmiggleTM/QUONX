//! This module manages the Python sidecar process.
//!
//! The Python sidecar is a separate process that runs a FastAPI server
//! for AI inference. This module is responsible for starting, stopping,
//! and communicating with the sidecar.

use std::process::Stdio;
use std::path::Path;
use log::{info, error, warn};
use serde::{Deserialize, Serialize};
use tokio::process::Command as TokioCommand;

/// Represents a request for AI inference sent to the Python sidecar.
#[derive(Debug, Serialize, Deserialize)]
pub struct InferenceRequest {
    /// The prompt to send to the AI model.
    pub prompt: String,
    /// The name of the model to use for inference.
    pub model: String,
    /// The maximum number of tokens to generate.
    pub max_tokens: Option<u32>,
    /// The temperature to use for sampling.
    pub temperature: Option<f32>,
}

/// Represents the response from an AI inference request from the Python sidecar.
#[derive(Debug, Serialize, Deserialize)]
pub struct InferenceResponse {
    /// The generated text from the model.
    pub response: String,
    /// The number of tokens used for the inference.
    pub tokens_used: Option<u32>,
    /// The name of the model that was used.
    pub model_used: String,
}

/// The main struct for managing the Python sidecar process.
#[derive(Debug)]
pub struct PythonSidecar {
    /// The handle to the Python sidecar process.
    process: Option<tokio::process::Child>,
    /// The port on which the Python sidecar is running.
    port: u16,
}

impl PythonSidecar {
    /// Creates a new `PythonSidecar` instance.
    ///
    /// # Returns
    ///
    /// * `Self` - A new `PythonSidecar` instance with default values.
    pub fn new() -> Self {
        Self {
            process: None,
            port: 8000,
        }
    }

    /// Starts the Python sidecar process.
    ///
    /// This method checks if the Python sidecar script exists and then
    /// spawns it as a new process.
    ///
    /// # Returns
    ///
    /// * `Result<(), Box<dyn std::error::Error>>` - An empty result on success,
    ///   or an error otherwise.
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

    /// Stops the Python sidecar process.
    pub async fn stop(&mut self) {
        if let Some(mut process) = self.process.take() {
            if let Err(e) = process.kill().await {
                error!("Failed to kill Python sidecar: {}", e);
            } else {
                info!("Stopped Python sidecar");
            }
        }
    }

    /// Checks if the Python sidecar process is running.
    ///
    /// # Returns
    ///
    /// * `bool` - `true` if the process is running, `false` otherwise.
    pub async fn is_running(&mut self) -> bool {
        if let Some(process) = &mut self.process {
            process.try_wait().map(|status| status.is_none()).unwrap_or(false)
        } else {
            false
        }
    }

    /// Performs a health check on the Python sidecar.
    ///
    /// # Returns
    ///
    /// * `Result<bool, Box<dyn std::error::Error>>` - `true` if the sidecar is
    ///   healthy, `false` otherwise.
    pub async fn health_check(&self) -> Result<bool, Box<dyn std::error::Error>> {
        let client = reqwest::Client::new();
        let url = format!("http://localhost:{}/health", self.port);
        
        match client.get(&url).timeout(std::time::Duration::from_secs(5)).send().await {
            Ok(response) => Ok(response.status().is_success()),
            Err(_) => Ok(false),
        }
    }

    /// Sends an inference request to the Python sidecar.
    ///
    /// # Arguments
    ///
    /// * `request` - An `InferenceRequest` struct containing the prompt and
    ///   other parameters.
    ///
    /// # Returns
    ///
    /// * `Result<InferenceResponse, Box<dyn std::error::Error>>` - An
    ///   `InferenceResponse` on success, or an error otherwise.
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

    /// Returns the port on which the Python sidecar is running.
    pub fn get_port(&self) -> u16 {
        self.port
    }
}

impl Drop for PythonSidecar {
    /// Kills the Python sidecar process when the `PythonSidecar` struct is
    /// dropped.
    fn drop(&mut self) {
        if let Some(mut process) = self.process.take() {
            let _ = process.kill();
        }
    }
}
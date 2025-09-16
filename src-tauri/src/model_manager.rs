//! This module is responsible for managing AI models.
//!
//! It handles scanning for available models, parsing model information,
//! and managing model configurations. It also provides functions for
//! checking for models from external services like Ollama and LM Studio.

use std::path::{Path, PathBuf};
use std::fs;
use serde::{Deserialize, Serialize};
use log::info;
use walkdir::WalkDir;

/// Represents information about a single AI model.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    /// The name of the model file.
    pub name: String,
    /// The path to the model file.
    pub path: String,
    /// The size of the model file in bytes.
    pub size: u64,
    /// The format of the model.
    pub format: ModelFormat,
    /// The number of parameters in the model, if known.
    pub parameters: Option<u64>,
}

/// An enum representing the different formats of AI models.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ModelFormat {
    /// The GGUF format, commonly used by `llama.cpp`.
    GGUF,
    /// The Safetensors format.
    Safetensors,
    /// The PyTorch format.
    Pytorch,
    /// Any other model format.
    Other(String),
}

/// Represents the configuration for the AI models.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    /// The name of the model to use for chat.
    pub chat_model: Option<String>,
    /// The name of the model to use for code generation.
    pub code_model: Option<String>,
    /// The name of the model to use for reasoning tasks.
    pub reasoner_model: Option<String>,
    /// The number of GPU layers to offload.
    pub n_gpu_layers: u32,
    /// The context size to use for the models.
    pub context_size: u32,
}

/// The main struct for managing AI models.
#[derive(Debug)]
pub struct ModelManager {
    /// The directory where the models are stored.
    models_dir: PathBuf,
    /// A list of all the available models.
    models: Vec<ModelInfo>,
    /// The current model configuration.
    config: ModelConfig,
}

impl ModelManager {
    /// Creates a new `ModelManager` instance.
    ///
    /// # Returns
    ///
    /// * `Self` - A new `ModelManager` instance with default values.
    pub fn new() -> Self {
        let models_dir = PathBuf::from("models");
        Self {
            models_dir,
            models: Vec::new(),
            config: ModelConfig {
                chat_model: None,
                code_model: None,
                reasoner_model: None,
                n_gpu_layers: 0,
                context_size: 2048,
            },
        }
    }

    /// Scans the models directory for available models.
    ///
    /// This method clears the current list of models and scans the `models_dir`
    /// for model files. It then parses each file to extract model information.
    ///
    /// # Returns
    ///
    /// * `Result<(), Box<dyn std::error::Error>>` - An empty result on success,
    ///   or an error otherwise.
    pub async fn scan_models(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        self.models.clear();
        
        if !self.models_dir.exists() {
            fs::create_dir_all(&self.models_dir)?;
            info!("Created models directory: {:?}", self.models_dir);
            return Ok(());
        }

        for entry in WalkDir::new(&self.models_dir)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            let path = entry.path();
            if let Some(model_info) = self.parse_model_file(path).await {
                self.models.push(model_info);
            }
        }

        info!("Found {} models", self.models.len());
        Ok(())
    }

    /// Parses a model file to extract information.
    ///
    /// # Arguments
    ///
    /// * `path` - The path to the model file.
    ///
    /// # Returns
    ///
    /// * `Option<ModelInfo>` - A `ModelInfo` struct if the file can be parsed,
    ///   or `None` otherwise.
    async fn parse_model_file(&self, path: &Path) -> Option<ModelInfo> {
        let file_name = path.file_name()?.to_string_lossy().to_string();
        let metadata = fs::metadata(path).ok()?;
        let size = metadata.len();

        let format = if file_name.ends_with(".gguf") {
            ModelFormat::GGUF
        } else if file_name.ends_with(".safetensors") {
            ModelFormat::Safetensors
        } else if file_name.ends_with(".bin") || file_name.ends_with(".pt") {
            ModelFormat::Pytorch
        } else {
            ModelFormat::Other(file_name.split('.').last()?.to_string())
        };

        // Try to extract parameter count from filename
        let parameters = self.extract_parameters_from_filename(&file_name);

        Some(ModelInfo {
            name: file_name,
            path: path.to_string_lossy().to_string(),
            size,
            format,
            parameters,
        })
    }

    /// Extracts the number of parameters from a model's filename.
    ///
    /// # Arguments
    ///
    /// * `filename` - The filename of the model.
    ///
    /// # Returns
    ///
    /// * `Option<u64>` - The number of parameters if it can be determined,
    ///   or `None` otherwise.
    fn extract_parameters_from_filename(&self, filename: &str) -> Option<u64> {
        // Common patterns for parameter extraction
        let patterns = [
            ("7b", 7_000_000_000),
            ("7B", 7_000_000_000),
            ("13b", 13_000_000_000),
            ("13B", 13_000_000_000),
            ("30b", 30_000_000_000),
            ("30B", 30_000_000_000),
            ("34b", 34_000_000_000),
            ("34B", 34_000_000_000),
            ("70b", 70_000_000_000),
            ("70B", 70_000_000_000),
        ];

        for (pattern, params) in patterns {
            if filename.to_lowercase().contains(pattern) {
                return Some(params);
            }
        }

        None
    }

    /// Returns a reference to the list of all models.
    pub fn get_models(&self) -> &Vec<ModelInfo> {
        &self.models
    }

    /// Returns a list of all GGUF models.
    pub fn get_gguf_models(&self) -> Vec<ModelInfo> {
        self.models
            .iter()
            .filter(|m| matches!(m.format, ModelFormat::GGUF))
            .cloned()
            .collect()
    }

    /// Returns a reference to a model by its name.
    pub fn get_model_by_name(&self, name: &str) -> Option<&ModelInfo> {
        self.models.iter().find(|m| m.name == name)
    }

    /// Returns a reference to the current model configuration.
    pub fn get_config(&self) -> &ModelConfig {
        &self.config
    }

    /// Updates the model configuration.
    pub fn update_config(&mut self, config: ModelConfig) {
        self.config = config;
        info!("Updated model configuration");
    }

    /// Sets the chat model.
    pub fn set_chat_model(&mut self, model_name: Option<String>) {
        self.config.chat_model = model_name;
    }

    /// Sets the code model.
    pub fn set_code_model(&mut self, model_name: Option<String>) {
        self.config.code_model = model_name;
    }

    /// Sets the reasoner model.
    pub fn set_reasoner_model(&mut self, model_name: Option<String>) {
        self.config.reasoner_model = model_name;
    }

    /// Sets the number of GPU layers to offload.
    pub fn set_gpu_layers(&mut self, layers: u32) {
        self.config.n_gpu_layers = layers;
    }

    /// Sets the context size for the models.
    pub fn set_context_size(&mut self, size: u32) {
        self.config.context_size = size;
    }

    /// Checks for available models from Ollama.
    ///
    /// # Returns
    ///
    /// * `Result<Vec<String>, Box<dyn std::error::Error>>` - A list of model
    ///   names on success, or an error otherwise.
    pub async fn check_ollama_models(&self) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        let client = reqwest::Client::new();
        let url = "http://localhost:11434/api/tags";
        
        match client.get(url).timeout(std::time::Duration::from_secs(5)).send().await {
            Ok(response) => {
                if response.status().is_success() {
                    let ollama_response: serde_json::Value = response.json().await?;
                    let models: Vec<String> = ollama_response["models"]
                        .as_array()
                        .unwrap_or(&vec![])
                        .iter()
                        .filter_map(|m| m["name"].as_str().map(|s| s.to_string()))
                        .collect();
                    Ok(models)
                } else {
                    Ok(vec![])
                }
            }
            Err(_) => Ok(vec![]),
        }
    }

    /// Checks for available models from LM Studio.
    ///
    /// # Returns
    ///
    /// * `Result<Vec<String>, Box<dyn std::error::Error>>` - A list of model
    ///   names on success, or an error otherwise.
    pub async fn check_lm_studio_models(&self) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        let client = reqwest::Client::new();
        let url = "http://localhost:1234/v1/models";
        
        match client.get(url).timeout(std::time::Duration::from_secs(5)).send().await {
            Ok(response) => {
                if response.status().is_success() {
                    let lm_response: serde_json::Value = response.json().await?;
                    let models: Vec<String> = lm_response["data"]
                        .as_array()
                        .unwrap_or(&vec![])
                        .iter()
                        .filter_map(|m| m["id"].as_str().map(|s| s.to_string()))
                        .collect();
                    Ok(models)
                } else {
                    Ok(vec![])
                }
            }
            Err(_) => Ok(vec![]),
        }
    }
}
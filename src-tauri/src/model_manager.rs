use std::path::{Path, PathBuf};
use std::fs;
use serde::{Deserialize, Serialize};
use log::info;
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub format: ModelFormat,
    pub parameters: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ModelFormat {
    GGUF,
    Safetensors,
    Pytorch,
    Other(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    pub chat_model: Option<String>,
    pub code_model: Option<String>,
    pub reasoner_model: Option<String>,
    pub n_gpu_layers: u32,
    pub context_size: u32,
}

#[derive(Debug)]
pub struct ModelManager {
    models_dir: PathBuf,
    models: Vec<ModelInfo>,
    config: ModelConfig,
}

impl ModelManager {
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

    pub fn get_models(&self) -> &Vec<ModelInfo> {
        &self.models
    }

    pub fn get_gguf_models(&self) -> Vec<ModelInfo> {
        self.models
            .iter()
            .filter(|m| matches!(m.format, ModelFormat::GGUF))
            .cloned()
            .collect()
    }

    pub fn get_model_by_name(&self, name: &str) -> Option<&ModelInfo> {
        self.models.iter().find(|m| m.name == name)
    }

    pub fn get_config(&self) -> &ModelConfig {
        &self.config
    }

    pub fn update_config(&mut self, config: ModelConfig) {
        self.config = config;
        info!("Updated model configuration");
    }

    pub fn set_chat_model(&mut self, model_name: Option<String>) {
        self.config.chat_model = model_name;
    }

    pub fn set_code_model(&mut self, model_name: Option<String>) {
        self.config.code_model = model_name;
    }

    pub fn set_reasoner_model(&mut self, model_name: Option<String>) {
        self.config.reasoner_model = model_name;
    }

    pub fn set_gpu_layers(&mut self, layers: u32) {
        self.config.n_gpu_layers = layers;
    }

    pub fn set_context_size(&mut self, size: u32) {
        self.config.context_size = size;
    }

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
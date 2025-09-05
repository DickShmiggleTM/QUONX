use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::fs;

use anyhow::{anyhow, Result};
use log::{info, warn, error, debug};
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;
use ignore::WalkBuilder;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectInfo {
    pub name: String,
    pub root_path: PathBuf,
    pub language: String,
    pub framework: Option<String>,
    pub file_count: usize,
    pub total_lines: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub path: PathBuf,
    pub size: u64,
    pub lines: usize,
    pub language: String,
    pub last_modified: u64,
}

pub struct ProjectManager {
    root_path: Option<PathBuf>,
    project_info: Option<ProjectInfo>,
    file_cache: HashMap<PathBuf, FileInfo>,
}

impl ProjectManager {
    pub fn new() -> Self {
        Self {
            root_path: None,
            project_info: None,
            file_cache: HashMap::new(),
        }
    }

    pub fn set_root_path(&mut self, path: PathBuf) {
        self.root_path = Some(path.clone());
        self.project_info = None;
        self.file_cache.clear();
        
        // Analyze the project in the background
        if let Err(e) = self.analyze_project() {
            error!("Failed to analyze project: {}", e);
        }
    }

    pub fn get_project_info(&self) -> Option<&ProjectInfo> {
        self.project_info.as_ref()
    }

    pub fn get_file_info(&self, path: &Path) -> Option<&FileInfo> {
        self.file_cache.get(path)
    }

    pub fn list_files(&self, pattern: Option<&str>) -> Vec<PathBuf> {
        let root = match &self.root_path {
            Some(path) => path,
            None => return Vec::new(),
        };

        let mut files = Vec::new();
        let walker = WalkBuilder::new(root)
            .hidden(false)
            .git_ignore(true)
            .build();

        for entry in walker {
            match entry {
                Ok(entry) => {
                    let path = entry.path();
                    if path.is_file() {
                        if let Some(pattern) = pattern {
                            if path.to_string_lossy().contains(pattern) {
                                files.push(path.to_path_buf());
                            }
                        } else {
                            files.push(path.to_path_buf());
                        }
                    }
                }
                Err(e) => warn!("Error walking directory: {}", e),
            }
        }

        files
    }

    pub fn search_in_files(&self, query: &str) -> Result<Vec<SearchResult>> {
        let root = match &self.root_path {
            Some(path) => path,
            None => return Ok(Vec::new()),
        };

        let mut results = Vec::new();
        let walker = WalkBuilder::new(root)
            .hidden(false)
            .git_ignore(true)
            .build();

        for entry in walker {
            match entry {
                Ok(entry) => {
                    let path = entry.path();
                    if path.is_file() && Self::is_text_file(path) {
                        if let Ok(content) = fs::read_to_string(path) {
                            for (line_num, line) in content.lines().enumerate() {
                                if line.to_lowercase().contains(&query.to_lowercase()) {
                                    results.push(SearchResult {
                                        path: path.to_path_buf(),
                                        line_number: line_num + 1,
                                        line_content: line.to_string(),
                                        match_start: line.to_lowercase().find(&query.to_lowercase()).unwrap_or(0),
                                        match_end: line.to_lowercase().find(&query.to_lowercase()).unwrap_or(0) + query.len(),
                                    });
                                }
                            }
                        }
                    }
                }
                Err(e) => warn!("Error searching files: {}", e),
            }
        }

        Ok(results)
    }

    fn analyze_project(&mut self) -> Result<()> {
        let root = match &self.root_path {
            Some(path) => path,
            None => return Err(anyhow!("No root path set")),
        };

        info!("Analyzing project at: {}", root.display());

        let project_name = root
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Unknown")
            .to_string();

        let mut file_count = 0;
        let mut total_lines = 0;
        let mut language_counts: HashMap<String, usize> = HashMap::new();

        let walker = WalkBuilder::new(root)
            .hidden(false)
            .git_ignore(true)
            .build();

        for entry in walker {
            match entry {
                Ok(entry) => {
                    let path = entry.path();
                    if path.is_file() {
                        file_count += 1;
                        
                        let language = Self::detect_language(path);
                        *language_counts.entry(language.clone()).or_insert(0) += 1;

                        if let Ok(metadata) = fs::metadata(path) {
                            let lines = if Self::is_text_file(path) {
                                Self::count_lines(path).unwrap_or(0)
                            } else {
                                0
                            };

                            total_lines += lines;

                            let file_info = FileInfo {
                                path: path.to_path_buf(),
                                size: metadata.len(),
                                lines,
                                language: language.clone(),
                                last_modified: metadata
                                    .modified()
                                    .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
                                    .duration_since(std::time::SystemTime::UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_secs(),
                            };

                            self.file_cache.insert(path.to_path_buf(), file_info);
                        }
                    }
                }
                Err(e) => warn!("Error analyzing file: {}", e),
            }
        }

        // Determine primary language
        let primary_language = language_counts
            .iter()
            .max_by_key(|(_, count)| *count)
            .map(|(lang, _)| lang.clone())
            .unwrap_or_else(|| "Unknown".to_string());

        // Detect framework
        let framework = Self::detect_framework(root);

        self.project_info = Some(ProjectInfo {
            name: project_name,
            root_path: root.clone(),
            language: primary_language,
            framework,
            file_count,
            total_lines,
        });

        info!("Project analysis complete: {} files, {} lines", file_count, total_lines);
        Ok(())
    }

    fn detect_language(path: &Path) -> String {
        if let Some(extension) = path.extension() {
            let ext = extension.to_string_lossy().to_lowercase();
            match ext.as_str() {
                "rs" => "Rust".to_string(),
                "py" => "Python".to_string(),
                "js" | "mjs" => "JavaScript".to_string(),
                "ts" => "TypeScript".to_string(),
                "jsx" => "JavaScript (React)".to_string(),
                "tsx" => "TypeScript (React)".to_string(),
                "java" => "Java".to_string(),
                "cpp" | "cc" | "cxx" => "C++".to_string(),
                "c" => "C".to_string(),
                "h" | "hpp" => "C/C++ Header".to_string(),
                "go" => "Go".to_string(),
                "php" => "PHP".to_string(),
                "rb" => "Ruby".to_string(),
                "swift" => "Swift".to_string(),
                "kt" => "Kotlin".to_string(),
                "scala" => "Scala".to_string(),
                "cs" => "C#".to_string(),
                "vb" => "Visual Basic".to_string(),
                "sql" => "SQL".to_string(),
                "html" => "HTML".to_string(),
                "css" => "CSS".to_string(),
                "scss" | "sass" => "SCSS/Sass".to_string(),
                "less" => "Less".to_string(),
                "vue" => "Vue".to_string(),
                "svelte" => "Svelte".to_string(),
                "json" => "JSON".to_string(),
                "yaml" | "yml" => "YAML".to_string(),
                "toml" => "TOML".to_string(),
                "xml" => "XML".to_string(),
                "md" => "Markdown".to_string(),
                "sh" => "Shell".to_string(),
                "bat" => "Batch".to_string(),
                "ps1" => "PowerShell".to_string(),
                _ => "Unknown".to_string(),
            }
        } else {
            "Unknown".to_string()
        }
    }

    fn detect_framework(root: &Path) -> Option<String> {
        // Check for common framework indicators
        if root.join("package.json").exists() {
            if let Ok(content) = fs::read_to_string(root.join("package.json")) {
                if content.contains("\"react\"") {
                    return Some("React".to_string());
                } else if content.contains("\"vue\"") {
                    return Some("Vue.js".to_string());
                } else if content.contains("\"angular\"") {
                    return Some("Angular".to_string());
                } else if content.contains("\"svelte\"") {
                    return Some("Svelte".to_string());
                } else if content.contains("\"next\"") {
                    return Some("Next.js".to_string());
                } else if content.contains("\"nuxt\"") {
                    return Some("Nuxt.js".to_string());
                }
            }
            return Some("Node.js".to_string());
        }

        if root.join("Cargo.toml").exists() {
            return Some("Rust".to_string());
        }

        if root.join("requirements.txt").exists() || root.join("pyproject.toml").exists() {
            return Some("Python".to_string());
        }

        if root.join("pom.xml").exists() {
            return Some("Maven (Java)".to_string());
        }

        if root.join("build.gradle").exists() {
            return Some("Gradle (Java/Kotlin)".to_string());
        }

        if root.join("go.mod").exists() {
            return Some("Go".to_string());
        }

        None
    }

    fn is_text_file(path: &Path) -> bool {
        if let Some(extension) = path.extension() {
            let ext = extension.to_string_lossy().to_lowercase();
            matches!(ext.as_str(),
                "rs" | "py" | "js" | "ts" | "jsx" | "tsx" | "java" | "cpp" | "c" | "h" |
                "go" | "php" | "rb" | "swift" | "kt" | "scala" | "cs" | "vb" | "sql" |
                "html" | "css" | "scss" | "sass" | "less" | "vue" | "svelte" | "json" |
                "yaml" | "yml" | "toml" | "xml" | "md" | "txt" | "sh" | "bat" | "ps1" |
                "gitignore" | "dockerfile" | "makefile" | "cmake" | "conf" | "cfg" | "ini"
            )
        } else {
            // Check common files without extensions
            if let Some(filename) = path.file_name() {
                let name = filename.to_string_lossy().to_lowercase();
                matches!(name.as_str(),
                    "dockerfile" | "makefile" | "cmakelists.txt" | "readme" | "license" |
                    "changelog" | "authors" | "contributors" | "copying" | "install"
                )
            } else {
                false
            }
        }
    }

    fn count_lines(path: &Path) -> Result<usize> {
        let content = fs::read_to_string(path)?;
        Ok(content.lines().count())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub path: PathBuf,
    pub line_number: usize,
    pub line_content: String,
    pub match_start: usize,
    pub match_end: usize,
}
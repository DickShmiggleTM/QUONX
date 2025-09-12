import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface ModelSettings {
  chatModel: string;
  codeModel: string;
  reasonerModel: string;
  nGpuLayers: number;
  contextSize: number;
  temperature: number;
  maxTokens: number;
}

export const SettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<ModelSettings>({
    chatModel: '',
    codeModel: '',
    reasonerModel: '',
    nGpuLayers: 0,
    contextSize: 2048,
    temperature: 0.7,
    maxTokens: 512
  });

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const models = await invoke<string[]>('get_available_models');
      setAvailableModels(models);
      
      // Load saved settings from localStorage or backend
      const savedSettings = localStorage.getItem('quonx-settings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = () => {
    localStorage.setItem('quonx-settings', JSON.stringify(settings));
    // Also save to backend
    invoke('save_settings', { settings });
  };

  const handleSettingChange = (key: keyof ModelSettings, value: string | number) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const resetToDefaults = () => {
    setSettings({
      chatModel: '',
      codeModel: '',
      reasonerModel: '',
      nGpuLayers: 0,
      contextSize: 2048,
      temperature: 0.7,
      maxTokens: 512
    });
  };

  if (isLoading) {
    return (
      <div className="settings-panel">
        <div className="loading-indicator">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>QUONX IDE SETTINGS</h2>
        <div className="settings-actions">
          <button onClick={saveSettings} className="save-button">
            SAVE
          </button>
          <button onClick={resetToDefaults} className="reset-button">
            RESET
          </button>
        </div>
      </div>

      <div className="settings-sections">
        <div className="settings-section">
          <h3>AI MODELS</h3>
          
          <div className="setting-item">
            <label>Chat Model:</label>
            <select
              value={settings.chatModel}
              onChange={(e) => handleSettingChange('chatModel', e.target.value)}
              className="setting-select"
            >
              <option value="">Select Chat Model</option>
              {availableModels.map(model => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </div>

          <div className="setting-item">
            <label>Code Model:</label>
            <select
              value={settings.codeModel}
              onChange={(e) => handleSettingChange('codeModel', e.target.value)}
              className="setting-select"
            >
              <option value="">Select Code Model</option>
              {availableModels.map(model => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </div>

          <div className="setting-item">
            <label>Reasoner Model:</label>
            <select
              value={settings.reasonerModel}
              onChange={(e) => handleSettingChange('reasonerModel', e.target.value)}
              className="setting-select"
            >
              <option value="">Select Reasoner Model</option>
              {availableModels.map(model => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="settings-section">
          <h3>PERFORMANCE</h3>
          
          <div className="setting-item">
            <label>GPU Layers:</label>
            <input
              type="number"
              min="0"
              max="100"
              value={settings.nGpuLayers}
              onChange={(e) => handleSettingChange('nGpuLayers', parseInt(e.target.value) || 0)}
              className="setting-input"
            />
            <span className="setting-description">
              Number of layers to offload to GPU (0 = CPU only)
            </span>
          </div>

          <div className="setting-item">
            <label>Context Size:</label>
            <input
              type="number"
              min="512"
              max="8192"
              step="512"
              value={settings.contextSize}
              onChange={(e) => handleSettingChange('contextSize', parseInt(e.target.value) || 2048)}
              className="setting-input"
            />
          </div>
        </div>

        <div className="settings-section">
          <h3>GENERATION</h3>
          
          <div className="setting-item">
            <label>Temperature:</label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.temperature}
              onChange={(e) => handleSettingChange('temperature', parseFloat(e.target.value))}
              className="setting-range"
            />
            <span className="setting-value">{settings.temperature}</span>
          </div>

          <div className="setting-item">
            <label>Max Tokens:</label>
            <input
              type="number"
              min="1"
              max="4096"
              value={settings.maxTokens}
              onChange={(e) => handleSettingChange('maxTokens', parseInt(e.target.value) || 512)}
              className="setting-input"
            />
          </div>
        </div>

        <div className="settings-section">
          <h3>SYSTEM</h3>
          
          <div className="setting-item">
            <label>Auto-save:</label>
            <input
              type="checkbox"
              defaultChecked
              className="setting-checkbox"
            />
          </div>

          <div className="setting-item">
            <label>File Watching:</label>
            <input
              type="checkbox"
              defaultChecked
              className="setting-checkbox"
            />
          </div>

          <div className="setting-item">
            <label>AI Suggestions:</label>
            <input
              type="checkbox"
              defaultChecked
              className="setting-checkbox"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { ModelSettings, RoleModels } from '../types.ts';

interface SettingsPanelProps {
  settings: ModelSettings;
  onSettingsChange: (newSettings: ModelSettings) => void;
  roleModels: RoleModels;
  onRoleModelsChange: (newRoles: RoleModels) => void;
  availableModels: string[];
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onSettingsChange, roleModels, onRoleModelsChange, availableModels }) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onSettingsChange({
      ...settings,
      [name]: e.target.type === 'range' ? parseFloat(value) : value,
    });
  };

  const handleRoleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    onRoleModelsChange({
      ...roleModels,
      [name]: value,
    });
  };

  // FIX: Use a specific string literal union for 'name' to satisfy TypeScript's expectations for DOM element attributes.
  const Slider: React.FC<{ name: 'temperature' | 'topP' | 'topK'; label: string; min: number; max: number; step: number; }> = ({ name, label, min, max, step }) => (
     <div className="flex flex-col mb-4">
        <label htmlFor={name} className="text-xs mb-1 flex justify-between">
          <span>{label}</span>
          <span>{settings[name]}</span>
        </label>
        <input
          type="range"
          id={name}
          name={name}
          min={min}
          max={max}
          step={step}
          value={settings[name]}
          onChange={handleInputChange}
          className="w-full"
        />
      </div>
  );

  // FIX: Use a specific string literal union for 'role' to avoid 'string | number | symbol' type issues.
  const ModelSelector: React.FC<{ role: 'chat' | 'code' | 'reasoner'; label: string }> = ({ role, label }) => (
    <div className="mb-3">
      <label htmlFor={`${role}-model`} className="text-xs mb-1 block">{label}</label>
      <select
        id={`${role}-model`}
        name={role}
        value={roleModels[role] || ''}
        onChange={handleRoleModelChange}
        className="w-full bg-black border border-green-700 p-1"
        disabled={availableModels.length === 0}
      >
        {availableModels.length > 0 ? (
          availableModels.map(model => (
            <option key={model} value={model}>{model}</option>
          ))
        ) : (
          <option>No models found in /models</option>
        )}
      </select>
    </div>
  );

  return (
    <div className="bg-black/50 border border-green-800 p-2 overflow-y-auto h-full">
      <h2 className="text-sm mb-2 border-b-2 border-green-800">SETTINGS</h2>
      <div className="text-xs">
          <ModelSelector role="chat" label="Chat Model" />
          <ModelSelector role="code" label="Code Model" />
          <ModelSelector role="reasoner" label="Reasoner Model" />
          
          <div className="border-t border-green-800 my-3"></div>

          <Slider name="temperature" label="Temperature" min={0} max={1} step={0.1} />
          <Slider name="topP" label="Top-P" min={0} max={1} step={0.05} />
          <Slider name="topK" label="Top-K" min={1} max={100} step={1} />
      </div>
    </div>
  );
};

export default SettingsPanel;
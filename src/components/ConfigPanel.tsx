import { useState } from 'react';
import { configManager, GamepadConfig } from '../utils/configManager';

interface FieldMapping {
  type: 'button' | 'axis';
  index: number;
  fieldName: string;
}

interface ConfigPanelProps {
  natsUrl: string;
  subject: string;
  mappings: FieldMapping[];
  onLoadConfig: (config: GamepadConfig) => void;
}

export const ConfigPanel = ({ natsUrl, subject, mappings, onLoadConfig }: ConfigPanelProps) => {
  const [savedConfigs, setSavedConfigs] = useState<GamepadConfig[]>(configManager.getAllConfigs());
  const [configName, setConfigName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showShareLink, setShowShareLink] = useState(false);
  const [shareLink, setShareLink] = useState('');

  const refreshConfigs = () => {
    setSavedConfigs(configManager.getAllConfigs());
  };

  const handleSaveConfig = () => {
    if (!configName.trim()) {
      alert('Please enter a config name');
      return;
    }

    configManager.saveConfig({
      name: configName.trim(),
      natsUrl,
      subject,
      mappings,
    });

    refreshConfigs();
    setConfigName('');
    setShowSaveDialog(false);
  };

  const handleLoadConfig = (config: GamepadConfig) => {
    onLoadConfig(config);
  };

  const handleDeleteConfig = (name: string) => {
    if (confirm(`Delete config "${name}"?`)) {
      configManager.deleteConfig(name);
      refreshConfigs();
    }
  };

  const handleExportConfig = (config: GamepadConfig) => {
    const json = configManager.exportConfig(config);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportConfig = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const config = configManager.importConfig(event.target?.result as string);
          configManager.saveConfig(config);
          refreshConfigs();
          alert(`Imported "${config.name}" successfully`);
        } catch (err) {
          alert('Failed to import config: Invalid file format');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleShareConfig = () => {
    const link = configManager.generateShareLink({
      name: configName.trim() || 'Shared Config',
      natsUrl,
      subject,
      mappings,
    });
    setShareLink(link);
    setShowShareLink(true);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    alert('Link copied to clipboard!');
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4">Configuration</h2>

      {/* Save Current Config */}
      <div className="mb-4">
        {!showSaveDialog ? (
          <button
            onClick={() => setShowSaveDialog(true)}
            disabled={mappings.length === 0}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Save Current Config
          </button>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={configName}
              onChange={(e) => setConfigName(e.target.value)}
              placeholder="Config name"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveConfig}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setConfigName('');
                }}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Import/Export/Share Buttons */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          onClick={handleImportConfig}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm"
        >
          Import JSON
        </button>
        <button
          onClick={handleShareConfig}
          disabled={mappings.length === 0}
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 text-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Share Link
        </button>
      </div>

      {/* Share Link Dialog */}
      {showShareLink && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-300 rounded">
          <p className="text-sm font-semibold mb-2">Share this link:</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={shareLink}
              readOnly
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs bg-white"
            />
            <button
              onClick={handleCopyLink}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs"
            >
              Copy
            </button>
          </div>
          <button
            onClick={() => setShowShareLink(false)}
            className="mt-2 text-xs text-gray-600 hover:text-gray-800"
          >
            Close
          </button>
        </div>
      )}

      {/* Saved Configs List */}
      <div>
        <h3 className="font-semibold text-gray-700 mb-2">Saved Configs ({savedConfigs.length})</h3>
        {savedConfigs.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No saved configs yet</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {savedConfigs.map((config) => (
              <div
                key={config.name}
                className="p-3 bg-gray-50 rounded border border-gray-200"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{config.name}</p>
                    <p className="text-xs text-gray-500">
                      {config.mappings.length} mappings • {new Date(config.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleLoadConfig(config)}
                    className="flex-1 px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-xs"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => handleExportConfig(config)}
                    className="flex-1 px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs"
                  >
                    Export
                  </button>
                  <button
                    onClick={() => handleDeleteConfig(config.name)}
                    className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

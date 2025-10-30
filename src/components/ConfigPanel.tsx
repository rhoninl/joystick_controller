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
  sendHz: number;
  sendByInterval: boolean;
  onLoadConfig: (config: GamepadConfig) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const ConfigPanel = ({ natsUrl, subject, mappings, sendHz, sendByInterval, onLoadConfig, isOpen, onClose }: ConfigPanelProps) => {
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
      sendHz,
      sendByInterval,
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
      sendHz,
      sendByInterval,
    });
    setShareLink(link);
    setShowShareLink(true);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    alert('Link copied to clipboard!');
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 backdrop-blur-xs animate-fadeIn"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-[420px] bg-white shadow-2xl z-50 overflow-y-auto animate-slideInRight">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-slate-200">
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Configuration
              </h2>
              <p className="text-sm text-slate-500 mt-1">Manage your saved configs</p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl p-2 transition-all duration-200 cursor-pointer"
            >
              <span className="text-3xl font-bold">×</span>
            </button>
          </div>

          {/* Save Current Config */}
          <div className="mb-6">
            {!showSaveDialog ? (
              <button
                onClick={() => setShowSaveDialog(true)}
                disabled={mappings.length === 0}
                className="w-full px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl hover:from-indigo-600 hover:to-purple-600 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed cursor-pointer font-semibold shadow-md hover:shadow-lg transition-all duration-200"
              >
                💾 Save Current Config
              </button>
            ) : (
              <div className="space-y-3 p-4 bg-slate-100 rounded-xl border border-slate-200">
                <input
                  type="text"
                  value={configName}
                  onChange={(e) => setConfigName(e.target.value)}
                  placeholder="Config name"
                  className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveConfig}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:from-emerald-600 hover:to-teal-600 font-semibold shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer"
                  >
                    ✓ Save
                  </button>
                  <button
                    onClick={() => {
                      setShowSaveDialog(false);
                      setConfigName('');
                    }}
                    className="flex-1 px-4 py-2.5 bg-slate-500 text-white rounded-xl hover:bg-slate-600 font-semibold shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Import/Export/Share Buttons */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={handleImportConfig}
              className="px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer"
            >
              📥 Import JSON
            </button>
            <button
              onClick={handleShareConfig}
              disabled={mappings.length === 0}
              className="px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl hover:from-orange-600 hover:to-amber-600 text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed cursor-pointer"
            >
              🔗 Share Link
            </button>
          </div>

          {/* Share Link Dialog */}
          {showShareLink && (
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl shadow-md">
              <p className="text-sm font-bold mb-3 text-blue-800 flex items-center gap-2">
                <span>🔗</span> Share this link:
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareLink}
                  readOnly
                  className="flex-1 px-3 py-2 border-2 border-blue-200 rounded-lg text-xs bg-white font-mono text-slate-600"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg hover:from-blue-600 hover:to-indigo-600 text-xs font-semibold shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  📋 Copy
                </button>
              </div>
              <button
                onClick={() => setShowShareLink(false)}
                className="mt-3 text-xs text-blue-600 hover:text-blue-800 font-semibold hover:underline cursor-pointer"
              >
                ✕ Close
              </button>
            </div>
          )}

          {/* Saved Configs List */}
          <div>
            <h3 className="font-bold text-slate-800 mb-4 text-lg flex items-center gap-2">
              <span>📦</span> Saved Configs ({savedConfigs.length})
            </h3>
            {savedConfigs.length === 0 ? (
              <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">
                <p className="text-slate-500 text-sm">No saved configs yet</p>
                <p className="text-slate-400 text-xs mt-1">Save your first config above</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                {savedConfigs.map((config) => (
                  <div
                    key={config.name}
                    className="p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border-2 border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <p className="font-bold text-sm text-slate-800">{config.name}</p>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <span>🔹</span> {config.mappings.length} mappings • {new Date(config.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleLoadConfig(config)}
                        className="flex-1 px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg hover:from-emerald-600 hover:to-teal-600 text-xs font-semibold shadow-sm hover:shadow-md transition-all cursor-pointer"
                      >
                        ✓ Load
                      </button>
                      <button
                        onClick={() => handleExportConfig(config)}
                        className="flex-1 px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg hover:from-blue-600 hover:to-indigo-600 text-xs font-semibold shadow-sm hover:shadow-md transition-all cursor-pointer"
                      >
                        📤 Export
                      </button>
                      <button
                        onClick={() => handleDeleteConfig(config.name)}
                        className="px-3 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg hover:from-red-600 hover:to-pink-600 text-xs font-semibold shadow-sm hover:shadow-md transition-all cursor-pointer"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

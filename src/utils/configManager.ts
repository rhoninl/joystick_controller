interface FieldMapping {
  type: 'button' | 'axis';
  index: number;
  fieldName: string;
}

export interface GamepadConfig {
  name: string;
  natsUrl: string;
  subject: string;
  mappings: FieldMapping[];
  sendHz?: number; // Optional for backward compatibility
  sendByInterval?: boolean; // Optional for backward compatibility
  createdAt: number;
}

const STORAGE_KEY = 'joystick_configs';

export const configManager = {
  // Get all saved configs
  getAllConfigs(): GamepadConfig[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.error('Failed to load configs:', err);
      return [];
    }
  },

  // Save a new config
  saveConfig(config: Omit<GamepadConfig, 'createdAt'>): void {
    const configs = this.getAllConfigs();
    const newConfig: GamepadConfig = {
      ...config,
      createdAt: Date.now(),
    };

    // Replace if name exists, otherwise add new
    const existingIndex = configs.findIndex(c => c.name === config.name);
    if (existingIndex >= 0) {
      configs[existingIndex] = newConfig;
    } else {
      configs.push(newConfig);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  },

  // Delete a config
  deleteConfig(name: string): void {
    const configs = this.getAllConfigs().filter(c => c.name !== name);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  },

  // Get a specific config
  getConfig(name: string): GamepadConfig | null {
    return this.getAllConfigs().find(c => c.name === name) || null;
  },

  // Export config as JSON string
  exportConfig(config: GamepadConfig): string {
    return JSON.stringify(config, null, 2);
  },

  // Import config from JSON string
  importConfig(jsonString: string): GamepadConfig {
    return JSON.parse(jsonString);
  },

  // Generate shareable link
  generateShareLink(config: Omit<GamepadConfig, 'createdAt'>): string {
    const configStr = JSON.stringify(config);
    const encoded = btoa(encodeURIComponent(configStr));
    const url = new URL(window.location.href);
    url.searchParams.set('config', encoded);
    return url.toString();
  },

  // Load config from URL parameter
  loadFromUrl(): GamepadConfig | null {
    try {
      const url = new URL(window.location.href);
      const encoded = url.searchParams.get('config');
      if (!encoded) return null;

      const configStr = decodeURIComponent(atob(encoded));
      const config = JSON.parse(configStr);
      return { ...config, createdAt: Date.now() };
    } catch (err) {
      console.error('Failed to load config from URL:', err);
      return null;
    }
  },

  // Clear URL parameter
  clearUrlConfig(): void {
    const url = new URL(window.location.href);
    url.searchParams.delete('config');
    window.history.replaceState({}, '', url.toString());
  },
};

import { useState, useEffect, useRef } from 'react';
import { connect, NatsConnection } from 'nats.ws';
import { useGamepad } from '../hooks/useGamepad';
import { ConfigPanel } from './ConfigPanel';
import { configManager, GamepadConfig } from '../utils/configManager';
import { TWallpaper } from '@twallpaper/react';
import '@twallpaper/react/css';

interface FieldMapping {
  type: 'button' | 'axis';
  index: number;
  fieldName: string;
}

export const Dashboard = () => {
  const [natsUrl, setNatsUrl] = useState('ws://localhost:9222');
  const [subject, setSubject] = useState('joystick.data');
  const [natsConnection, setNatsConnection] = useState<NatsConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [currentValues, setCurrentValues] = useState<{ [key: string]: any }>({});
  const [sendHz, setSendHz] = useState(2); // Default to 2 Hz
  const [sendByInterval, setSendByInterval] = useState(false); // Default to change-detection
  const [isConfigDrawerOpen, setIsConfigDrawerOpen] = useState(false);

  const { gamepads, selectedGamepadIndex, setSelectedGamepadIndex, gamepadState } = useGamepad();
  const lastSentState = useRef<{ [key: number]: boolean }>({});
  const lastAxisValues = useRef<{ [key: number]: number }>({});

  // Load config from URL on mount
  useEffect(() => {
    const urlConfig = configManager.loadFromUrl();
    if (urlConfig) {
      setNatsUrl(urlConfig.natsUrl);
      setSubject(urlConfig.subject);
      setMappings(urlConfig.mappings);
      if (urlConfig.sendHz !== undefined) {
        setSendHz(urlConfig.sendHz);
      }
      if (urlConfig.sendByInterval !== undefined) {
        setSendByInterval(urlConfig.sendByInterval);
      }
      configManager.clearUrlConfig();
      alert(`Loaded shared config: "${urlConfig.name}"`);
    }
  }, []);

  const handleConnect = async () => {
    try {
      setError(null);
      const nc = await connect({ servers: natsUrl });
      setNatsConnection(nc);
      setIsConnected(true);
      console.log('Connected to NATS at', natsUrl);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to connect to NATS';
      setError(errorMsg);
      console.error('NATS connection error:', err);
    }
  };

  const handleDisconnect = async () => {
    if (natsConnection) {
      await natsConnection.close();
      setNatsConnection(null);
      setIsConnected(false);
      setIsStreaming(false);
      console.log('Disconnected from NATS');
    }
  };

  // Update current values based on gamepad state and mappings
  useEffect(() => {
    if (!gamepadState || mappings.length === 0) {
      setCurrentValues({});
      return;
    }

    const values: { [key: string]: any } = {};

    mappings.forEach((mapping) => {
      if (mapping.type === 'button') {
        values[mapping.fieldName] = gamepadState.buttons[mapping.index] ? 1 : 0;
      } else if (mapping.type === 'axis') {
        values[mapping.fieldName] = gamepadState.axes[mapping.index]?.toFixed(2) || 0;
      }
    });

    setCurrentValues(values);
  }, [gamepadState, mappings]);

  // Send data - supports both interval-based and change-detection modes
  useEffect(() => {
    if (!isStreaming || !natsConnection || !gamepadState || mappings.length === 0) {
      return;
    }

    const deadZone = 0.05; // Small deadzone to filter noise

    // Helper function to build payload
    const buildPayload = () => {
      const payload: any = {};
      mappings.forEach((mapping) => {
        if (mapping.type === 'button') {
          const isPressed = gamepadState.buttons[mapping.index];
          payload[mapping.fieldName] = isPressed ? 1 : 0;
        } else if (mapping.type === 'axis') {
          const rawValue = gamepadState.axes[mapping.index] || 0;
          const currentValue = Math.abs(rawValue) < deadZone ? 0 : rawValue;
          payload[mapping.fieldName] = parseFloat(currentValue.toFixed(2));
        }
      });
      return payload;
    };

    // Helper function to send payload
    const sendPayload = (payload: any) => {
      try {
        natsConnection.publish(subject, new TextEncoder().encode(JSON.stringify(payload)));
        console.log('Published:', payload);
        setLastMessage(payload);
      } catch (err) {
        console.error('Failed to publish:', err);
      }
    };

    if (sendByInterval) {
      // Interval-based mode: send at fixed Hz rate
      const intervalMs = 1000 / sendHz;
      const intervalId = setInterval(() => {
        const payload = buildPayload();
        sendPayload(payload);
      }, intervalMs);

      return () => {
        clearInterval(intervalId);
      };
    } else {
      // Change-detection mode: send only when values change
      let hasChange = false;
      const payload: any = {};

      mappings.forEach((mapping) => {
        if (mapping.type === 'button') {
          const isPressed = gamepadState.buttons[mapping.index];
          const wasPressed = lastSentState.current[mapping.index];

          if (isPressed !== wasPressed) {
            hasChange = true;
            lastSentState.current[mapping.index] = isPressed;
          }
          payload[mapping.fieldName] = isPressed ? 1 : 0;

        } else if (mapping.type === 'axis') {
          const rawValue = gamepadState.axes[mapping.index] || 0;
          const lastValue = lastAxisValues.current[mapping.index];
          const currentValue = Math.abs(rawValue) < deadZone ? 0 : rawValue;

          if (lastValue === undefined || currentValue !== lastValue) {
            hasChange = true;
            lastAxisValues.current[mapping.index] = currentValue;
          }
          payload[mapping.fieldName] = parseFloat(currentValue.toFixed(2));
        }
      });

      if (hasChange) {
        sendPayload(payload);
      }
    }
  }, [gamepadState, natsConnection, mappings, subject, isStreaming, sendHz, sendByInterval]);

  const addMapping = (type: 'button' | 'axis', index: number, fieldName: string) => {
    if (!fieldName.trim()) return;

    // Remove existing mapping for this button/axis
    const filtered = mappings.filter(
      m => !(m.type === type && m.index === index)
    );

    setMappings([...filtered, { type, index, fieldName: fieldName.trim() }]);
  };

  const removeMapping = (type: 'button' | 'axis', index: number) => {
    setMappings(mappings.filter(m => !(m.type === type && m.index === index)));
  };

  const getMapping = (type: 'button' | 'axis', index: number) => {
    return mappings.find(m => m.type === type && m.index === index);
  };

  const handleLoadConfig = (config: GamepadConfig) => {
    setNatsUrl(config.natsUrl);
    setSubject(config.subject);
    setMappings(config.mappings);
    if (config.sendHz !== undefined) {
      setSendHz(config.sendHz);
    }
    if (config.sendByInterval !== undefined) {
      setSendByInterval(config.sendByInterval);
    }
    alert(`Loaded config: "${config.name}"`);
  };

  return (
    <div className="min-h-screen relative overflow-hidden p-8">
      {/* Animated Wallpaper Background */}
      <TWallpaper
        options={{
          colors: [
            '#818cf8', // indigo-400
            '#c084fc', // purple-400
            '#f472b6', // pink-400
            '#60a5fa'  // blue-400
          ],
          animate: true,
          scrollAnimate: true,
          pattern: {
            image: "https://twallpaper.js.org/patterns/games.svg",
            background: "#000",
            size: "800px",
          }
        }}
      />

      {/* Content */}
      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Joystick Controller
              </h1>
              <p className="text-slate-500 mt-1">Real-time gamepad data streaming via NATS</p>
            </div>
            <button
              onClick={() => setIsConfigDrawerOpen(true)}
              className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl hover:from-indigo-600 hover:to-purple-600 font-medium shadow-md hover:shadow-lg transition-all duration-200 btn-press hover-lift cursor-pointer"
            >
              ⚙️ Configuration
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* NATS Connection */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-200 animate-slideInUp">
              <h2 className="text-2xl font-bold mb-6 text-slate-800 flex items-center gap-2">
                <span className="text-2xl">🔌</span> Connection
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    WebSocket URL
                  </label>
                  <input
                    type="text"
                    value={natsUrl}
                    onChange={(e) => setNatsUrl(e.target.value)}
                    disabled={isConnected}
                    placeholder="ws://localhost:9222"
                    className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={isStreaming}
                    placeholder="joystick.data"
                    className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition-all"
                  />
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="checkbox"
                      id="sendByInterval"
                      checked={sendByInterval}
                      onChange={(e) => setSendByInterval(e.target.checked)}
                      disabled={isStreaming}
                      className="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 disabled:opacity-50 cursor-pointer"
                    />
                    <label htmlFor="sendByInterval" className="text-sm font-semibold text-slate-700 cursor-pointer">
                      📡 Send by interval
                    </label>
                  </div>
                  {sendByInterval && (
                    <div className="mt-3 pl-8">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Send Frequency (Hz)
                      </label>
                      <input
                        type="number"
                        value={sendHz}
                        onChange={(e) => setSendHz(Math.max(1, Math.min(100, Number(e.target.value))))}
                        disabled={isStreaming}
                        min="1"
                        max="100"
                        placeholder="2"
                        className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                      />
                      <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                        ⚡ Sends {sendHz}x per second
                      </p>
                    </div>
                  )}
                  {!sendByInterval && (
                    <p className="text-xs text-slate-500 pl-8 flex items-center gap-1">
                      ⚡ Sends only when values change
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  {!isConnected ? (
                    <button
                      onClick={handleConnect}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:from-emerald-600 hover:to-teal-600 font-semibold shadow-md hover:shadow-lg transition-all duration-200 btn-press hover-lift cursor-pointer"
                    >
                      Connect
                    </button>
                  ) : (
                    <button
                      onClick={handleDisconnect}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl hover:from-red-600 hover:to-pink-600 font-semibold shadow-md hover:shadow-lg transition-all duration-200 btn-press hover-lift cursor-pointer"
                    >
                      Disconnect
                    </button>
                  )}

                  <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 ${isConnected ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-100 border-slate-200'
                    }`}>
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                        }`}
                    />
                    <span className={`text-sm font-semibold ${isConnected ? 'text-emerald-700' : 'text-slate-600'
                      }`}>
                      {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-sm font-medium">
                    ⚠️ {error}
                  </div>
                )}
              </div>
            </div>

            {/* Gamepad Selection */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-200 animate-slideInUp" style={{ animationDelay: '0.1s' }}>
              <h2 className="text-2xl font-bold mb-6 text-slate-800 flex items-center gap-2">
                <span className="text-2xl">🎮</span> Select Gamepad
              </h2>
              {gamepads.length === 0 ? (
                <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">
                  <p className="text-slate-500 text-sm">
                    No gamepads detected
                  </p>
                  <p className="text-slate-400 text-xs mt-1">
                    Press any button on your gamepad to connect
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {gamepads.map((gamepad) => (
                    <div
                      key={gamepad.index}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${selectedGamepadIndex === gamepad.index
                        ? 'border-indigo-500 bg-gradient-to-r from-indigo-50 to-purple-50 shadow-md'
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                        }`}
                      onClick={() => setSelectedGamepadIndex(gamepad.index)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm text-slate-800">{gamepad.id}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {gamepad.buttons.length} buttons • {gamepad.axes.length} axes
                          </p>
                        </div>
                        {selectedGamepadIndex === gamepad.index && (
                          <span className="px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg text-xs font-semibold shadow-sm">
                            ✓ Selected
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Streaming Control */}
            {selectedGamepadIndex !== null && (
              <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-200 animate-slideInUp" style={{ animationDelay: '0.2s' }}>
                <h2 className="text-2xl font-bold mb-6 text-slate-800 flex items-center gap-2">
                  <span className="text-2xl">📡</span> Streaming
                </h2>
                <button
                  onClick={() => setIsStreaming(!isStreaming)}
                  disabled={!isConnected || mappings.length === 0}
                  className={`w-full px-6 py-4 rounded-xl font-bold text-lg shadow-lg transition-all duration-200 btn-press hover-lift cursor-pointer ${isStreaming
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white hover:shadow-xl animate-pulse'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed disabled:shadow-none'
                    }`}
                >
                  {isStreaming ? '⏹ Stop Streaming' : '▶ Start Streaming'}
                </button>
                {!isConnected && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm flex items-center gap-2">
                    <span>⚠️</span>
                    <span>Connect to NATS first</span>
                  </div>
                )}
                {mappings.length === 0 && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm flex items-center gap-2">
                    <span>⚠️</span>
                    <span>Add field mappings first</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Field Mappings Configuration */}
            {selectedGamepadIndex !== null && gamepadState && (
              <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-200 animate-slideInUp">
                <h2 className="text-2xl font-bold mb-6 text-slate-800 flex items-center gap-2">
                  <span className="text-2xl">🗺️</span> Field Mappings
                </h2>

                <div className="space-y-5 max-h-96 overflow-y-auto pr-2">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <p className="text-sm text-blue-700 flex items-center gap-2">
                      <span>💡</span>
                      <span>Press buttons or move axes to identify them</span>
                    </p>
                  </div>

                  {/* Buttons */}
                  <div>
                    <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                      <span>🔘</span> Buttons
                    </h3>
                    <div className="space-y-2">
                      {gamepadState.buttons.map((isPressed, index) => {
                        const mapping = getMapping('button', index);
                        return (
                          <div
                            key={`btn-${index}`}
                            className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all duration-150 ${isPressed
                              ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-400 shadow-md'
                              : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                              }`}
                          >
                            <div className="flex items-center gap-2 w-20">
                              <div
                                className={`w-3 h-3 rounded-full transition-all ${isPressed ? 'bg-emerald-500 scale-110 shadow-sm' : 'bg-slate-300'
                                  }`}
                              />
                              <span className={`text-xs font-bold ${isPressed ? 'text-emerald-700' : 'text-slate-600'
                                }`}>
                                B{index}
                              </span>
                            </div>
                            <input
                              type="text"
                              placeholder="Field name"
                              defaultValue={mapping?.fieldName || ''}
                              onBlur={(e) => {
                                if (e.target.value.trim()) {
                                  addMapping('button', index, e.target.value);
                                } else if (mapping) {
                                  removeMapping('button', index);
                                }
                              }}
                              className="flex-1 px-3 py-1.5 border-2 border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                            />
                            {mapping && (
                              <button
                                onClick={() => removeMapping('button', index)}
                                className="px-2 py-1 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg text-xs font-semibold hover:from-red-600 hover:to-pink-600 transition-all shadow-sm hover:shadow-md cursor-pointer"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Axes */}
                  {gamepadState.axes.length > 0 && (
                    <div>
                      <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                        <span>🎚️</span> Axes
                      </h3>
                      <div className="space-y-2">
                        {gamepadState.axes.map((axisValue, index) => {
                          const mapping = getMapping('axis', index);
                          const isMoving = Math.abs(axisValue) > 0.1;
                          return (
                            <div
                              key={`axis-${index}`}
                              className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all duration-150 ${isMoving
                                ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-400 shadow-md'
                                : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                                }`}
                            >
                              <div className="flex items-center gap-2 w-20">
                                <div className={`text-xs font-mono font-bold w-12 text-right ${isMoving ? 'text-blue-600' : 'text-slate-600'
                                  }`}>
                                  {axisValue.toFixed(2)}
                                </div>
                                <span className={`text-xs font-bold ${isMoving ? 'text-blue-700' : 'text-slate-600'
                                  }`}>
                                  A{index}
                                </span>
                              </div>
                              <input
                                type="text"
                                placeholder="Field name"
                                defaultValue={mapping?.fieldName || ''}
                                onBlur={(e) => {
                                  if (e.target.value.trim()) {
                                    addMapping('axis', index, e.target.value);
                                  } else if (mapping) {
                                    removeMapping('axis', index);
                                  }
                                }}
                                className="flex-1 px-3 py-1.5 border-2 border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                              />
                              {mapping && (
                                <button
                                  onClick={() => removeMapping('axis', index)}
                                  className="px-2 py-1 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg text-xs font-semibold hover:from-red-600 hover:to-pink-600 transition-all shadow-sm hover:shadow-md cursor-pointer"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Current Values */}
            {Object.keys(currentValues).length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-200 animate-slideInUp" style={{ animationDelay: '0.1s' }}>
                <h2 className="text-2xl font-bold mb-6 text-slate-800 flex items-center gap-2">
                  <span className="text-2xl">📊</span> Current Values
                </h2>
                <div className="space-y-2">
                  {Object.entries(currentValues).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center p-3 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200 hover:shadow-sm transition-shadow">
                      <span className="font-semibold text-slate-700">{key}</span>
                      <span className="font-mono font-bold text-indigo-600 bg-white px-3 py-1 rounded-lg shadow-sm">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Last Message Sent */}
            {lastMessage && (
              <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-200 animate-scaleIn">
                <h2 className="text-2xl font-bold mb-6 text-slate-800 flex items-center gap-2">
                  <span className="text-2xl">📤</span> Last Message Sent
                </h2>
                <pre className="bg-gray-900 text-emerald-400 p-5 rounded-xl text-sm overflow-x-auto shadow-inner font-mono animate-fadeIn">
                  {JSON.stringify(lastMessage, null, 2)}
                </pre>
              </div>
            )}

            {/* Config Management */}
            <ConfigPanel
              natsUrl={natsUrl}
              subject={subject}
              mappings={mappings}
              sendHz={sendHz}
              sendByInterval={sendByInterval}
              onLoadConfig={handleLoadConfig}
              isOpen={isConfigDrawerOpen}
              onClose={() => setIsConfigDrawerOpen(false)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

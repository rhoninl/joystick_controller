import { useState, useEffect, useRef } from 'react';
import { connect, NatsConnection } from 'nats.ws';
import { useGamepad } from '../hooks/useGamepad';
import { ConfigPanel } from './ConfigPanel';
import { configManager, GamepadConfig } from '../utils/configManager';

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

  // Send data when buttons pressed or axes moved
  useEffect(() => {
    if (!isStreaming || !natsConnection || !gamepadState || mappings.length === 0) {
      return;
    }

    let hasChange = false;
    const payload: any = {};
    const deadZone = 0.05; // Small deadzone to filter noise

    // Check all mappings for changes
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

        // Apply deadzone - treat small values as 0
        const currentValue = Math.abs(rawValue) < deadZone ? 0 : rawValue;

        // Send if value changed at all (including returning to 0)
        if (lastValue === undefined || currentValue !== lastValue) {
          hasChange = true;
          lastAxisValues.current[mapping.index] = currentValue;
        }

        payload[mapping.fieldName] = parseFloat(currentValue.toFixed(2));
      }
    });

    // Always send data if any value changed
    if (hasChange) {
      try {
        natsConnection.publish(subject, new TextEncoder().encode(JSON.stringify(payload)));
        console.log('Published:', payload);
        setLastMessage(payload);
      } catch (err) {
        console.error('Failed to publish:', err);
      }
    }
  }, [gamepadState, natsConnection, mappings, subject, isStreaming]);

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
    alert(`Loaded config: "${config.name}"`);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-4xl font-bold text-gray-800">Joystick Controller</h1>

        <div className="grid grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* NATS Connection */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold mb-4">NATS Connection</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    WebSocket URL
                  </label>
                  <input
                    type="text"
                    value={natsUrl}
                    onChange={(e) => setNatsUrl(e.target.value)}
                    disabled={isConnected}
                    placeholder="ws://localhost:9222"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={isStreaming}
                    placeholder="joystick.data"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>

                <div className="flex items-center gap-4 pt-2">
                  {!isConnected ? (
                    <button
                      onClick={handleConnect}
                      className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium"
                    >
                      Connect
                    </button>
                  ) : (
                    <button
                      onClick={handleDisconnect}
                      className="px-6 py-2 bg-red-500 text-white rounded hover:bg-red-600 font-medium"
                    >
                      Disconnect
                    </button>
                  )}

                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        isConnected ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                    <span className="text-sm font-medium text-gray-700">
                      {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
                    {error}
                  </div>
                )}
              </div>
            </div>

            {/* Gamepad Selection */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold mb-4">Select Gamepad</h2>
              {gamepads.length === 0 ? (
                <p className="text-gray-500 italic text-sm">
                  No gamepads detected. Press any button on your gamepad.
                </p>
              ) : (
                <div className="space-y-2">
                  {gamepads.map((gamepad) => (
                    <div
                      key={gamepad.index}
                      className={`p-3 rounded border-2 cursor-pointer transition-colors ${
                        selectedGamepadIndex === gamepad.index
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-400'
                      }`}
                      onClick={() => setSelectedGamepadIndex(gamepad.index)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">{gamepad.id}</p>
                          <p className="text-xs text-gray-500">
                            {gamepad.buttons.length} buttons, {gamepad.axes.length} axes
                          </p>
                        </div>
                        {selectedGamepadIndex === gamepad.index && (
                          <span className="px-2 py-1 bg-blue-500 text-white rounded text-xs font-medium">
                            Selected
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
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold mb-4">Streaming</h2>
                <button
                  onClick={() => setIsStreaming(!isStreaming)}
                  disabled={!isConnected || mappings.length === 0}
                  className={`w-full px-6 py-3 rounded font-medium text-lg ${
                    isStreaming
                      ? 'bg-orange-500 hover:bg-orange-600 text-white'
                      : 'bg-green-500 hover:bg-green-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed'
                  }`}
                >
                  {isStreaming ? 'Stop Streaming' : 'Start Streaming'}
                </button>
                {!isConnected && (
                  <p className="text-yellow-600 mt-2 text-sm">Connect to NATS first</p>
                )}
                {mappings.length === 0 && (
                  <p className="text-yellow-600 mt-2 text-sm">Add field mappings first</p>
                )}
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Field Mappings Configuration */}
            {selectedGamepadIndex !== null && gamepadState && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold mb-4">Field Mappings</h2>

                <div className="space-y-4 max-h-96 overflow-y-auto">
                  <p className="text-sm text-gray-500 italic mb-3">
                    Press buttons or move axes to identify them
                  </p>

                  {/* Buttons */}
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2">Buttons</h3>
                    <div className="space-y-2">
                      {gamepadState.buttons.map((isPressed, index) => {
                        const mapping = getMapping('button', index);
                        return (
                          <div
                            key={`btn-${index}`}
                            className={`flex items-center gap-2 p-2 rounded transition-colors ${
                              isPressed ? 'bg-green-100 border-2 border-green-500' : 'bg-white border-2 border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2 w-24">
                              <div
                                className={`w-3 h-3 rounded-full ${
                                  isPressed ? 'bg-green-500' : 'bg-gray-300'
                                }`}
                              />
                              <span className={`text-sm font-medium ${
                                isPressed ? 'text-green-700' : 'text-gray-600'
                              }`}>
                                Btn {index}
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
                              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {mapping && (
                              <button
                                onClick={() => removeMapping('button', index)}
                                className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
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
                      <h3 className="font-semibold text-gray-700 mb-2">Axes</h3>
                      <div className="space-y-2">
                        {gamepadState.axes.map((axisValue, index) => {
                          const mapping = getMapping('axis', index);
                          const isMoving = Math.abs(axisValue) > 0.1;
                          return (
                            <div
                              key={`axis-${index}`}
                              className={`flex items-center gap-2 p-2 rounded transition-colors ${
                                isMoving ? 'bg-blue-100 border-2 border-blue-500' : 'bg-white border-2 border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2 w-24">
                                <div className="text-sm font-mono text-gray-600 w-12 text-right">
                                  {axisValue.toFixed(2)}
                                </div>
                                <span className={`text-sm font-medium ${
                                  isMoving ? 'text-blue-700' : 'text-gray-600'
                                }`}>
                                  Ax {index}
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
                                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              {mapping && (
                                <button
                                  onClick={() => removeMapping('axis', index)}
                                  className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
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
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold mb-4">Current Values</h2>
                <div className="space-y-2">
                  {Object.entries(currentValues).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="font-medium text-gray-700">{key}:</span>
                      <span className="font-mono text-blue-600">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Last Message Sent */}
            {lastMessage && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold mb-4">Last Message Sent</h2>
                <pre className="bg-gray-900 text-green-400 p-4 rounded text-sm overflow-x-auto">
                  {JSON.stringify(lastMessage, null, 2)}
                </pre>
              </div>
            )}

            {/* Config Management */}
            <ConfigPanel
              natsUrl={natsUrl}
              subject={subject}
              mappings={mappings}
              onLoadConfig={handleLoadConfig}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

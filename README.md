# Joystick Controller

A web-based application that connects gamepads/joysticks to NATS messaging systems, enabling real-time streaming of controller input data to any NATS-enabled application.

## Features

- **Gamepad Detection**: Automatically detects and lists all connected gamepads
- **Real-time Streaming**: Streams button presses and axis movements to NATS subjects
- **Custom Field Mapping**: Map any button or axis to custom field names for your application
- **NATS Integration**: Connect to any NATS server via WebSocket
- **Configuration Management**:
  - Save and load multiple configurations
  - Import/export configurations as JSON files
  - Share configurations via URL links
- **Visual Feedback**: Real-time display of button states, axis values, and published messages
- **Deadzone Filtering**: Built-in deadzone to filter out joystick drift and noise

## Prerequisites

- A modern web browser with Gamepad API support (Chrome, Firefox, Edge, etc.)
- A NATS server with WebSocket support enabled
- A USB or Bluetooth gamepad/joystick

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd joysticker_controller
```

2. Install dependencies:
```bash
npm install
# or
bun install
```

3. Start the development server:
```bash
npm run dev
# or
bun dev
```

The application will open in your browser at `http://localhost:3000`.

## Usage

### 1. Connect Your Gamepad
- Plug in your USB gamepad or connect via Bluetooth
- Press any button on the gamepad to activate it
- The gamepad will appear in the "Select Gamepad" section

### 2. Connect to NATS
- Enter your NATS WebSocket URL (default: `ws://localhost:9222`)
- Enter the subject name where data will be published (default: `joystick.data`)
- Click "Connect"

### 3. Map Controller Inputs
- Press buttons or move joystick axes to identify them
- Enter a field name for each button or axis you want to use
- The mapping will be saved automatically

### 4. Start Streaming
- Click "Start Streaming" to begin publishing data to NATS
- Move your controller to see real-time data being sent
- The "Last Message Sent" panel shows the JSON payload

### 5. Save Your Configuration
- Click "Save Current Config" and give it a name
- Load saved configurations anytime from the "Saved Configs" list
- Export configurations as JSON files to share with others
- Generate shareable links to send configurations to teammates

## Message Format

The application publishes JSON messages to NATS with the following structure:

```json
{
  "forward": 0.85,
  "turn": -0.32,
  "fire": 1,
  "jump": 0
}
```

- **Buttons**: Send `1` when pressed, `0` when released
- **Axes**: Send floating-point values from `-1.00` to `1.00`
- Values below the deadzone threshold (0.05) are automatically set to `0`

## Configuration

### NATS Server Setup

To enable WebSocket support in NATS, configure your server with:

```conf
websocket {
  port: 9222
  no_tls: true
}
```

### Example Configuration File

```json
{
  "name": "Racing Game",
  "natsUrl": "ws://localhost:9222",
  "subject": "game.controls",
  "mappings": [
    { "type": "button", "index": 0, "fieldName": "accelerate" },
    { "type": "button", "index": 1, "fieldName": "brake" },
    { "type": "axis", "index": 0, "fieldName": "steering" }
  ],
  "createdAt": 1234567890000
}
```

## Development

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Project Structure
```
src/
├── components/
│   ├── Dashboard.tsx        # Main application UI
│   └── ConfigPanel.tsx      # Configuration management
├── hooks/
│   └── useGamepad.ts        # Gamepad API integration
├── utils/
│   └── configManager.ts     # Config save/load/share logic
├── App.tsx                  # Root component
└── index.tsx                # Application entry point
```

## Deployment

This project is configured for deployment to Cloudflare Pages:

```bash
npm run build
npx wrangler pages deploy
```

Alternatively, deploy to any static hosting service (Vercel, Netlify, etc.) by building and serving the `dist` folder.

## Technical Stack

- **React 19** - UI framework
- **TypeScript** - Type-safe JavaScript
- **NATS.ws** - NATS WebSocket client
- **Gamepad API** - Browser API for controller access
- **Tailwind CSS** - Utility-first styling
- **Rsbuild** - Fast build tool
- **Cloudflare Pages** - Deployment platform (optional)

## Browser Compatibility

The Gamepad API is supported in:
- Chrome/Edge 21+
- Firefox 29+
- Safari 10.1+

Note: Some browsers may require user interaction (button press) before detecting gamepads.

## Use Cases

- **Robotics**: Control robots remotely via NATS messaging
- **Gaming**: Stream controller input to game servers
- **Simulation**: Drive simulators with real controller hardware
- **IoT**: Control IoT devices with gamepad inputs
- **Automation**: Use gamepads as input devices for industrial automation
- **Remote Control**: Control remote systems over NATS infrastructure

## Troubleshooting

**Gamepad not detected:**
- Press any button on the gamepad after connecting
- Check browser console for errors
- Try a different USB port or browser

**NATS connection fails:**
- Verify NATS server is running with WebSocket support
- Check the WebSocket URL and port
- Ensure firewall allows WebSocket connections

**No data being sent:**
- Verify you've added field mappings
- Ensure "Start Streaming" is active
- Check that NATS connection shows as "Connected"

## License

[Add your license here]

## Contributing

[Add contribution guidelines here]

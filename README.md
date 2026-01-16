# Pong Frontend

React frontend for retro Pong game with Centrifugo WebSocket.

## Features

- **Anonymous spectator mode**: Watch ongoing games
- **Lobby system**: Join as first or second player
- **Real-time gameplay**: 60 FPS canvas rendering
- **Keyboard controls**: Arrow keys ↑/↓
- **Score tracking**: First to 10 wins
- **Clean retro design**: Black & white, pixel-perfect

## Setup

```bash
# Install dependencies
npm install

# Configure
cp .env.example .env
# Edit .env if needed

# Run development server
npm run dev
```

## Requirements

Local:
- **Centrifugo** `ws://localhost:8000`
- **Backend API** `http://localhost:8080`

Production:
- Set `VITE_CENTRIFUGO_URL` and `VITE_BACKEND_URL` before build.
- Example:
  - `VITE_CENTRIFUGO_URL=wss://<centrifugo-lb-host>/connection/websocket`
  - `VITE_BACKEND_URL=https://<backend-lb-host>`

See `../iac/centrifugo/` and `../pong-backend/` for setup.

## How It Works

### Lobby Flow
1. Connect to Centrifugo anonymously
2. Subscribe to `pong_public:lobby` channel
3. Get history (last 10 messages)
4. Show available places based on history
5. Join by clicking a place button

### Gameplay
1. After joining, get connection + subscription tokens
2. Subscribe to private channel for enemy moves
3. Use ↑/↓ to move paddle
4. Send `pong.move` RPC calls
5. Receive enemy moves on private channel
6. See all events on public channel

### Spectator Mode
- If game is already started when you join
- See all moves and scores in real-time
- No controls, just watch

## Design

- **Margins**: 30% left/right, 20% top/bottom
- **Colors**: Black background, white elements
- **Canvas**: Scales to fit available space
- **Font**: Courier New (retro monospace)

## Controls

| Key | Action |
|-----|--------|
| ↑ | Move paddle up |
| ↓ | Move paddle down |

## Build

```bash
npm run build
```

Output in `dist/` directory.

## Project Structure

```
src/
├── App.jsx              # Main app logic
├── App.css
├── config.js            # Game constants
├── components/
│   ├── LobbyScreen.jsx  # Lobby UI
│   ├── LobbyScreen.css
│   ├── GameCanvas.jsx   # Game rendering
│   └── GameCanvas.css
└── main.jsx             # Entry point
```

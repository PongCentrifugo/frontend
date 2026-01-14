// Game constants from original Atari Pong specs
export const GAME_CONFIG = {
  // Playfield dimensions (in blocks)
  PLAYFIELD_WIDTH: 375,
  PLAYFIELD_HEIGHT: 246,
  
  // Paddle dimensions
  PADDLE_WIDTH: 4,
  PADDLE_HEIGHT: 15,
  
  // Ball dimensions
  BALL_WIDTH: 4,
  BALL_HEIGHT: 4,
  
  // Net
  NET_WIDTH: 1,
  NET_DASH_HEIGHT: 4,
  NET_DASH_SPACING: 4,
  
  // Score
  WIN_SCORE: 10,
  
  // Paddle positions
  PADDLE_OFFSET_X: 20, // Distance from edge
  
  // Movement
  PADDLE_SPEED: 5, // Blocks per frame
  BALL_SPEED: 3,
  
  // Update rate
  TICK_RATE: 1000 / 60, // 60 FPS
}

// API endpoints
export const API_CONFIG = {
  CENTRIFUGO_URL: import.meta.env.VITE_CENTRIFUGO_URL || 'ws://localhost:8000/connection/websocket',
  BACKEND_URL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080',
}

// Channels (updated to use underscore for namespace compatibility)
export const CHANNELS = {
  // Namespaced public channel so Centrifugo namespace options apply.
  PUBLIC: 'pong_public:lobby',
  PRIVATE_FIRST: 'pong_private:first',
  PRIVATE_SECOND: 'pong_private:second',
}

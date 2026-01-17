import { useEffect, useRef, useState } from 'react'
import { GAME_CONFIG } from '../config'
import './LobbyScreen.css'

function DemoCanvas() {
  const canvasRef = useRef(null)
  const [scale, setScale] = useState(1)
  const gameState = useRef({
    ball: { x: 187.5, y: 123, vx: 3, vy: 2 },
    paddle1: 115,
    paddle2: 115,
  })

  const { PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT, PADDLE_WIDTH, PADDLE_HEIGHT, PADDLE_OFFSET_X, BALL_WIDTH, BALL_HEIGHT, NET_WIDTH, NET_DASH_HEIGHT, NET_DASH_SPACING } = GAME_CONFIG

  useEffect(() => {
    const updateSize = () => {
      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight
      const availableWidth = windowWidth * 0.4
      const availableHeight = windowHeight * 0.6
      const scaleX = availableWidth / PLAYFIELD_WIDTH
      const scaleY = availableHeight / PLAYFIELD_HEIGHT
      setScale(Math.min(scaleX, scaleY))
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const loop = () => {
      const s = gameState.current

      // AI paddles follow ball
      const target1 = s.ball.y - PADDLE_HEIGHT / 2
      const target2 = s.ball.y - PADDLE_HEIGHT / 2
      s.paddle1 += (target1 - s.paddle1) * 0.04
      s.paddle2 += (target2 - s.paddle2) * 0.06
      s.paddle1 = Math.max(0, Math.min(PLAYFIELD_HEIGHT - PADDLE_HEIGHT, s.paddle1))
      s.paddle2 = Math.max(0, Math.min(PLAYFIELD_HEIGHT - PADDLE_HEIGHT, s.paddle2))

      // Ball movement
      s.ball.x += s.ball.vx
      s.ball.y += s.ball.vy

      // Wall bounce
      if (s.ball.y <= 0 || s.ball.y >= PLAYFIELD_HEIGHT - BALL_HEIGHT) {
        s.ball.vy *= -1
        s.ball.y = Math.max(0, Math.min(PLAYFIELD_HEIGHT - BALL_HEIGHT, s.ball.y))
      }

      // Paddle bounce
      const leftPaddleX = PADDLE_OFFSET_X
      const rightPaddleX = PLAYFIELD_WIDTH - PADDLE_OFFSET_X - PADDLE_WIDTH

      if (s.ball.x <= leftPaddleX + PADDLE_WIDTH && s.ball.y + BALL_HEIGHT > s.paddle1 && s.ball.y < s.paddle1 + PADDLE_HEIGHT && s.ball.vx < 0) {
        s.ball.vx = Math.abs(s.ball.vx) * 1.02
        s.ball.x = leftPaddleX + PADDLE_WIDTH
      }
      if (s.ball.x >= rightPaddleX - BALL_WIDTH && s.ball.y + BALL_HEIGHT > s.paddle2 && s.ball.y < s.paddle2 + PADDLE_HEIGHT && s.ball.vx > 0) {
        s.ball.vx = -Math.abs(s.ball.vx) * 1.02
        s.ball.x = rightPaddleX - BALL_WIDTH
      }

      // Reset if out
      if (s.ball.x < -20 || s.ball.x > PLAYFIELD_WIDTH + 20) {
        s.ball.x = PLAYFIELD_WIDTH / 2
        s.ball.y = PLAYFIELD_HEIGHT / 2
        s.ball.vx = Math.random() > 0.5 ? 3 : -3
        s.ball.vy = (Math.random() - 0.5) * 4
      }

      // Render - match website background #0a0a0a
      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(0, 0, PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT)

      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'

      // Net
      const netX = PLAYFIELD_WIDTH / 2 - NET_WIDTH / 2
      for (let y = 0; y < PLAYFIELD_HEIGHT; y += NET_DASH_HEIGHT + NET_DASH_SPACING) {
        ctx.fillRect(netX, y, NET_WIDTH, NET_DASH_HEIGHT)
      }

      // Paddles
      ctx.fillRect(PADDLE_OFFSET_X, s.paddle1, PADDLE_WIDTH, PADDLE_HEIGHT)
      ctx.fillRect(PLAYFIELD_WIDTH - PADDLE_OFFSET_X - PADDLE_WIDTH, s.paddle2, PADDLE_WIDTH, PADDLE_HEIGHT)

      // Ball
      ctx.fillRect(s.ball.x, s.ball.y, BALL_WIDTH, BALL_HEIGHT)
    }

    const id = setInterval(loop, GAME_CONFIG.TICK_RATE)
    return () => clearInterval(id)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={PLAYFIELD_WIDTH}
      height={PLAYFIELD_HEIGHT}
      className="demo-canvas"
      style={{
        width: `${PLAYFIELD_WIDTH * scale}px`,
        height: `${PLAYFIELD_HEIGHT * scale}px`,
        imageRendering: 'pixelated',
      }}
    />
  )
}

export default function LobbyScreen({ lobbyStatus, onJoin }) {
  const { firstTaken, secondTaken, gameStarted } = lobbyStatus

  return (
    <div className="lobby">
      <h1 className="lobby-title">PONG</h1>

      <div className="lobby-status">
        {!firstTaken && !secondTaken && (
          <p>Choose your side</p>
        )}

        {(firstTaken || secondTaken) && !gameStarted && (
          <p>Waiting for {firstTaken ? 'Player 2' : 'Player 1'}...</p>
        )}
      </div>

      <div className="lobby-demo-area">
        <DemoCanvas />
        <div className="lobby-buttons">
          <button
            className={`play-button ${firstTaken ? 'taken' : ''}`}
            onClick={() => onJoin('first')}
            disabled={firstTaken}
          >
            <span className="button-label">Player 1</span>
            <span className="button-sublabel">{firstTaken ? 'Joined' : 'Left Side'}</span>
          </button>

          <button
            className={`play-button ${secondTaken ? 'taken' : ''}`}
            onClick={() => onJoin('second')}
            disabled={secondTaken}
          >
            <span className="button-label">Player 2</span>
            <span className="button-sublabel">{secondTaken ? 'Joined' : 'Right Side'}</span>
          </button>
        </div>
      </div>

      <div className="lobby-info">
        <p>First to 10 wins  ·  Use arrow keys to move</p>
      </div>
    </div>
  )
}

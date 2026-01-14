import { useEffect, useRef, useState } from 'react'
import { GAME_CONFIG, API_CONFIG } from '../config'
import './GameCanvas.css'

export default function GameCanvas({ gameData, myPlace, isSpectator, centrifuge, myUserId, onLeave }) {
  const canvasRef = useRef(null)
  const [scale, setScale] = useState(1)
  const keysPressed = useRef(new Set())
  const lastMoveTime = useRef(0)

  // Calculate canvas size with 30% side margins and 20% top/bottom margins
  useEffect(() => {
    const updateSize = () => {
      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight
      
      // Available space: 40% width, 60% height
      const availableWidth = windowWidth * 0.4
      const availableHeight = windowHeight * 0.6
      
      // Calculate scale to fit
      const scaleX = availableWidth / GAME_CONFIG.PLAYFIELD_WIDTH
      const scaleY = availableHeight / GAME_CONFIG.PLAYFIELD_HEIGHT
      const newScale = Math.min(scaleX, scaleY)
      
      setScale(newScale)
    }
    
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  // Keyboard controls
  useEffect(() => {
    if (isSpectator) return

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        keysPressed.current.add(e.key)
      }
    }

    const handleKeyUp = (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        keysPressed.current.delete(e.key)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [isSpectator])

  // Game loop
  useEffect(() => {
    if (isSpectator) return

    const interval = setInterval(() => {
      const now = Date.now()
      if (now - lastMoveTime.current < 50) return // Rate limit to 20Hz

      let dy = 0
      if (keysPressed.current.has('ArrowUp')) dy -= GAME_CONFIG.PADDLE_SPEED
      if (keysPressed.current.has('ArrowDown')) dy += GAME_CONFIG.PADDLE_SPEED

      if (dy !== 0) {
        sendMove(dy)
        lastMoveTime.current = now
      }
    }, GAME_CONFIG.TICK_RATE)

    return () => clearInterval(interval)
  }, [isSpectator, centrifuge])

  const sendMove = async (dy) => {
    if (!centrifuge) return

    try {
      const result = await centrifuge.rpc('pong.move', {
        dy,
        client_ts_ms: Date.now(),
      })
      
      console.log('Move result:', result)
    } catch (error) {
      console.error('Move error:', error)
    }
  }

  // Render game
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const { PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT, PADDLE_WIDTH, PADDLE_HEIGHT, BALL_WIDTH, BALL_HEIGHT, NET_WIDTH, NET_DASH_HEIGHT, NET_DASH_SPACING, PADDLE_OFFSET_X } = GAME_CONFIG

    const render = () => {
      // Clear
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT)

      // Net (dashed line in center)
      ctx.fillStyle = '#fff'
      const netX = PLAYFIELD_WIDTH / 2 - NET_WIDTH / 2
      for (let y = 0; y < PLAYFIELD_HEIGHT; y += NET_DASH_HEIGHT + NET_DASH_SPACING) {
        ctx.fillRect(netX, y, NET_WIDTH, NET_DASH_HEIGHT)
      }

      // Paddles
      // First player (left)
      ctx.fillRect(
        PADDLE_OFFSET_X,
        gameData.firstPaddleY,
        PADDLE_WIDTH,
        PADDLE_HEIGHT
      )

      // Second player (right)
      ctx.fillRect(
        PLAYFIELD_WIDTH - PADDLE_OFFSET_X - PADDLE_WIDTH,
        gameData.secondPaddleY,
        PADDLE_WIDTH,
        PADDLE_HEIGHT
      )

      // Ball (centered for now, will move later)
      ctx.fillRect(
        gameData.ballX || PLAYFIELD_WIDTH / 2 - BALL_WIDTH / 2,
        gameData.ballY || PLAYFIELD_HEIGHT / 2 - BALL_HEIGHT / 2,
        BALL_WIDTH,
        BALL_HEIGHT
      )

      // Scores
      ctx.font = 'bold 32px "Courier New"'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      
      // First player score (left)
      ctx.fillText(gameData.firstScore.toString(), PLAYFIELD_WIDTH / 4, 20)
      
      // Second player score (right)
      ctx.fillText(gameData.secondScore.toString(), (PLAYFIELD_WIDTH / 4) * 3, 20)
    }

    const animationFrame = requestAnimationFrame(function loop() {
      render()
      requestAnimationFrame(loop)
    })

    return () => cancelAnimationFrame(animationFrame)
  }, [gameData])

  const width = GAME_CONFIG.PLAYFIELD_WIDTH
  const height = GAME_CONFIG.PLAYFIELD_HEIGHT

  return (
    <div className="game-container">
      <div className="game-wrapper">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{
            width: `${width * scale}px`,
            height: `${height * scale}px`,
            imageRendering: 'pixelated',
          }}
        />
      </div>
      
      <div className="game-controls">
        {!isSpectator && (
          <div className="player-info">
            Playing as: <strong>{myPlace === 'first' ? 'LEFT' : 'RIGHT'}</strong>
          </div>
        )}
        {isSpectator && (
          <div className="spectator-info">👁 Spectator Mode</div>
        )}
        
        <button onClick={onLeave} className="leave-button">
          Leave Game
        </button>
      </div>
    </div>
  )
}

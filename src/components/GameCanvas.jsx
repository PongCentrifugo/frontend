import { useEffect, useRef, useState } from 'react'
import { GAME_CONFIG, API_CONFIG } from '../config'
import './GameCanvas.css'

export default function GameCanvas({ gameData, myPlace, isSpectator, centrifuge, myUserId, onLeave }) {
  const canvasRef = useRef(null)
  const [scale, setScale] = useState(1)
  const keysPressed = useRef(new Set())
  const lastMoveTime = useRef(0)
  
  // Ball state (only first player simulates)
  const ballState = useRef({
    x: GAME_CONFIG.PLAYFIELD_WIDTH / 2,
    y: GAME_CONFIG.PLAYFIELD_HEIGHT / 2,
    vx: 0,
    vy: 0,
    active: false,
    lastUpdate: Date.now()
  })

  // Interpolated ball position for smooth rendering (Player 2 and spectators)
  const ballDisplay = useRef({
    x: GAME_CONFIG.PLAYFIELD_WIDTH / 2,
    y: GAME_CONFIG.PLAYFIELD_HEIGHT / 2,
    targetX: GAME_CONFIG.PLAYFIELD_WIDTH / 2,
    targetY: GAME_CONFIG.PLAYFIELD_HEIGHT / 2,
  })

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

  // Initialize ball when game starts
  useEffect(() => {
    // Start ball after a short delay
    setTimeout(() => {
      resetBall()
    }, 1000)
  }, [])

  // Reset ball when score changes (goal was scored)
  const prevScore = useRef(gameData.firstScore + gameData.secondScore)
  useEffect(() => {
    const currentScore = gameData.firstScore + gameData.secondScore
    if (currentScore > prevScore.current) {
      // Score increased, reset ball after delay
      ballState.current.active = false
      setTimeout(() => {
        resetBall()
      }, 1500)
    }
    prevScore.current = currentScore
  }, [gameData.firstScore, gameData.secondScore])

  // Sync ball position from gameData for non-first players
  useEffect(() => {
    if (myPlace !== 'first' && gameData.ballX !== undefined && gameData.ballY !== undefined) {
      // Update target position for interpolation
      ballDisplay.current.targetX = gameData.ballX
      ballDisplay.current.targetY = gameData.ballY
      
      // On first update, snap to position (avoid interpolating from center)
      const isFirstUpdate = ballDisplay.current.x === GAME_CONFIG.PLAYFIELD_WIDTH / 2 && 
                           ballDisplay.current.y === GAME_CONFIG.PLAYFIELD_HEIGHT / 2
      if (isFirstUpdate) {
        ballDisplay.current.x = gameData.ballX
        ballDisplay.current.y = gameData.ballY
      }
    }
  }, [myPlace, gameData.ballX, gameData.ballY])

  // Smooth interpolation loop for Player 2 and spectators
  useEffect(() => {
    if (myPlace === 'first') return // First player doesn't need interpolation

    const interval = setInterval(() => {
      const display = ballDisplay.current
      const lerpFactor = 0.3 // Higher = faster catch-up (0.3 = smooth)

      // Lerp towards target position
      display.x += (display.targetX - display.x) * lerpFactor
      display.y += (display.targetY - display.y) * lerpFactor
    }, GAME_CONFIG.TICK_RATE)

    return () => clearInterval(interval)
  }, [myPlace])

  // Ball physics loop (ONLY first player - others sync from move events)
  // Using setInterval instead of requestAnimationFrame so it runs even when tab is inactive
  useEffect(() => {
    // Only first player simulates ball physics
    if (myPlace !== 'first') return

    const interval = setInterval(() => {
      const ball = ballState.current
      if (!ball.active) return

      const { PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT, PADDLE_WIDTH, PADDLE_HEIGHT, PADDLE_OFFSET_X, BALL_WIDTH, BALL_HEIGHT } = GAME_CONFIG

      // Update position
      ball.x += ball.vx
      ball.y += ball.vy

      // Collision with top/bottom walls
      if (ball.y <= 0 || ball.y + BALL_HEIGHT >= PLAYFIELD_HEIGHT) {
        ball.vy = -ball.vy
        ball.y = Math.max(0, Math.min(ball.y, PLAYFIELD_HEIGHT - BALL_HEIGHT))
      }

      // Collision with left paddle (first player)
      const leftPaddleX = PADDLE_OFFSET_X
      const leftPaddleY = gameData.firstPaddleY
      
      if (ball.x <= leftPaddleX + PADDLE_WIDTH &&
          ball.x + BALL_WIDTH >= leftPaddleX &&
          ball.y + BALL_HEIGHT >= leftPaddleY &&
          ball.y <= leftPaddleY + PADDLE_HEIGHT &&
          ball.vx < 0) {
        ball.vx = -ball.vx
        ball.x = leftPaddleX + PADDLE_WIDTH
      }

      // Collision with right paddle (second player)
      const rightPaddleX = PLAYFIELD_WIDTH - PADDLE_OFFSET_X - PADDLE_WIDTH
      const rightPaddleY = gameData.secondPaddleY
      
      if (ball.x + BALL_WIDTH >= rightPaddleX &&
          ball.x <= rightPaddleX + PADDLE_WIDTH &&
          ball.y + BALL_HEIGHT >= rightPaddleY &&
          ball.y <= rightPaddleY + PADDLE_HEIGHT &&
          ball.vx > 0) {
        ball.vx = -ball.vx
        ball.x = rightPaddleX - BALL_WIDTH
      }

      // Goal detection (only first player reports since only they simulate)
      if (ball.x < 0) {
        // Second player scored
        ball.active = false
        sendGoal('second')
      } else if (ball.x + BALL_WIDTH > PLAYFIELD_WIDTH) {
        // First player scored
        ball.active = false
        sendGoal('first')
      }
    }, GAME_CONFIG.TICK_RATE)

    return () => clearInterval(interval)
  }, [myPlace, isSpectator, gameData])

  // Paddle control loop
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

  // Ball position broadcast (only first player)
  const lastBallBroadcast = useRef(0)
  useEffect(() => {
    if (myPlace !== 'first' || isSpectator) return

    const interval = setInterval(() => {
      const now = Date.now()
      // Broadcast ball position every 100ms (10Hz) even without paddle movement
      if (now - lastBallBroadcast.current >= 100 && ballState.current.active) {
        sendMove(0) // Send with dy=0 to just update ball position
        lastBallBroadcast.current = now
      }
    }, 50)

    return () => clearInterval(interval)
  }, [myPlace, isSpectator])

  const sendMove = async (dy) => {
    if (!centrifuge) return

    try {
      // First player includes ball position for synchronization
      const params = {
        dy,
        client_ts_ms: Date.now(),
      }
      
      if (myPlace === 'first') {
        params.ball_x = ballState.current.x
        params.ball_y = ballState.current.y
      }
      
      await centrifuge.rpc('pong.move', params)
    } catch (error) {
      console.error('Move error:', JSON.stringify(error))
    }
  }

  const sendGoal = async (scoredBy) => {
    if (!centrifuge) return

    try {
      const result = await centrifuge.rpc('pong.goal', {
        scored_by: scoredBy,
        client_ts_ms: Date.now(),
      })
      
      // Check if game ended (result has the RPC response data directly)
      if (result?.data?.game_ended) {
        console.log('Game ended! Winner:', result.data.winner)
      }
      // Ball will be reset automatically when the goal event updates the score
    } catch (error) {
      console.error('Goal error:', error)
    }
  }

  const resetBall = () => {
    const speed = 3
    // Deterministic: alternate direction based on total score
    const totalScore = gameData.firstScore + gameData.secondScore
    const direction = totalScore % 2 === 0 ? 1 : -1
    const angle = 0 // Straight horizontal for predictability
    
    ballState.current = {
      x: GAME_CONFIG.PLAYFIELD_WIDTH / 2,
      y: GAME_CONFIG.PLAYFIELD_HEIGHT / 2,
      vx: direction * speed * Math.cos(angle),
      vy: speed * Math.sin(angle),
      active: true,
      lastUpdate: Date.now()
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

      // Ball - first player uses physics simulation, others use interpolated display
      const ballX = myPlace === 'first' ? ballState.current.x : ballDisplay.current.x
      const ballY = myPlace === 'first' ? ballState.current.y : ballDisplay.current.y
      
      ctx.fillRect(
        ballX,
        ballY,
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

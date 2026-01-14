import { useEffect, useRef, useState } from 'react'
import { GAME_CONFIG, API_CONFIG } from '../config'
import './GameCanvas.css'

export default function GameCanvas({ gameData, myPlace, isSpectator, centrifuge, myUserId, onLeave }) {
  const canvasRef = useRef(null)
  const [scale, setScale] = useState(1)
  const keysPressed = useRef(new Set())
  const lastMoveTime = useRef(0)
  const [authorityPulse, setAuthorityPulse] = useState(0)

  // Keep latest state in refs so we don't restart loops on every update.
  const gameDataRef = useRef(gameData)
  const myPlaceRef = useRef(myPlace)
  const isSpectatorRef = useRef(isSpectator)

  useEffect(() => {
    gameDataRef.current = gameData
  }, [gameData])
  useEffect(() => {
    myPlaceRef.current = myPlace
  }, [myPlace])
  useEffect(() => {
    isSpectatorRef.current = isSpectator
  }, [isSpectator])
  
  // Ball state (only first player simulates)
  const ballState = useRef({
    x: GAME_CONFIG.PLAYFIELD_WIDTH / 2,
    y: GAME_CONFIG.PLAYFIELD_HEIGHT / 2,
    vx: 0,
    vy: 0,
    active: false,
    lastUpdate: Date.now()
  })

  const isBallAuthority = (() => {
    if (isSpectator) return false
    if (!myPlace) return false
    // If someone is actively broadcasting ball state, follow them.
    if (gameData.ballAuthorityPlace && gameData.ballAuthorityAtMs) {
      const expired = Date.now() - gameData.ballAuthorityAtMs > 250
      return gameData.ballAuthorityPlace === myPlace || expired
    }
    // Default authority is the first player (initial game).
    return myPlace === 'first'
  })()

  // Re-evaluate authority expiry even if no events arrive.
  useEffect(() => {
    if (isSpectator || !myPlace) return
    const id = setInterval(() => setAuthorityPulse((p) => p + 1), 100)
    return () => clearInterval(id)
  }, [isSpectator, myPlace])

  // Keep authority in a ref for long-lived loops (render loop).
  const isBallAuthorityRef = useRef(isBallAuthority)
  useEffect(() => {
    isBallAuthorityRef.current = isBallAuthority
    // authorityPulse is intentionally used to cause periodic re-evaluation above
  }, [isBallAuthority, authorityPulse])

  // Interpolated ball position for smooth rendering (Player 2 and spectators)
  const ballDisplay = useRef({
    x: GAME_CONFIG.PLAYFIELD_WIDTH / 2,
    y: GAME_CONFIG.PLAYFIELD_HEIGHT / 2,
    targetX: GAME_CONFIG.PLAYFIELD_WIDTH / 2,
    targetY: GAME_CONFIG.PLAYFIELD_HEIGHT / 2,
    // Source snapshot for simple prediction
    srcX: GAME_CONFIG.PLAYFIELD_WIDTH / 2,
    srcY: GAME_CONFIG.PLAYFIELD_HEIGHT / 2,
    srcVx: 0,
    srcVy: 0,
    srcAtMs: Date.now(),
    hasEverSynced: false,
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

  // If we become the ball authority (e.g., other tab got throttled), initialize from last known state.
  const wasAuthorityRef = useRef(false)
  useEffect(() => {
    if (!isBallAuthority) {
      wasAuthorityRef.current = false
      return
    }
    if (wasAuthorityRef.current) return
    wasAuthorityRef.current = true

    // Seed from the last received snapshot if available; otherwise reset.
    if (gameData.ballX !== undefined && gameData.ballY !== undefined) {
      const vx = gameData.ballVx ?? 0
      const vy = gameData.ballVy ?? 0
      ballState.current = {
        x: gameData.ballX,
        y: gameData.ballY,
        vx: vx === 0 && vy === 0 ? 3 : vx,
        vy,
        active: true,
        lastUpdate: Date.now(),
      }
    } else {
      resetBall()
    }
  }, [isBallAuthority, gameData.ballX, gameData.ballY, gameData.ballVx, gameData.ballVy])

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
      const now = Date.now()
      const d = ballDisplay.current
      d.srcX = gameData.ballX
      d.srcY = gameData.ballY
      d.srcVx = gameData.ballVx ?? 0
      d.srcVy = gameData.ballVy ?? 0
      d.srcAtMs = now

      // On first sync, snap immediately to avoid "ball in center" artifact.
      if (!d.hasEverSynced) {
        d.x = gameData.ballX
        d.y = gameData.ballY
        d.hasEverSynced = true
      }
    }
  }, [myPlace, gameData.ballX, gameData.ballY, gameData.ballVx, gameData.ballVy])

  // Smooth interpolation loop for Player 2 and spectators
  useEffect(() => {
    if (myPlace === 'first') return // First player doesn't need interpolation

    const interval = setInterval(() => {
      const d = ballDisplay.current

      // Predict current position from last received snapshot.
      const dtMs = Date.now() - d.srcAtMs
      const dtTicks = dtMs / (1000 / 60) // vx/vy are in "blocks per 60Hz tick"
      d.targetX = d.srcX + d.srcVx * dtTicks
      d.targetY = d.srcY + d.srcVy * dtTicks

      // Smoothly approach the predicted target.
      const lerpFactor = 0.35
      d.x += (d.targetX - d.x) * lerpFactor
      d.y += (d.targetY - d.y) * lerpFactor
    }, GAME_CONFIG.TICK_RATE)

    return () => clearInterval(interval)
  }, [myPlace])

  // Ball physics loop (ONLY first player - others sync from move events)
  // Using setInterval instead of requestAnimationFrame so it runs even when tab is inactive
  useEffect(() => {
    if (!isBallAuthority) return

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
      const leftPaddleY = gameDataRef.current.firstPaddleY
      
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
      const rightPaddleY = gameDataRef.current.secondPaddleY
      
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
  }, [isBallAuthority])

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
    if (!isBallAuthority) return

    const interval = setInterval(() => {
      const now = Date.now()
      // Broadcast ball state frequently so non-first clients can predict smoothly.
      // (Even if dy=0)
      if (now - lastBallBroadcast.current >= 33 && ballState.current.active) {
        sendMove(0) // Send with dy=0 to just update ball position
        lastBallBroadcast.current = now
      }
    }, 16)

    return () => clearInterval(interval)
  }, [isBallAuthority])

  const sendMove = async (dy) => {
    if (!centrifuge) return

    try {
      // First player includes ball position for synchronization
      const params = {
        dy,
        client_ts_ms: Date.now(),
      }
      
      if (isBallAuthority) {
        params.ball_x = ballState.current.x
        params.ball_y = ballState.current.y
        params.ball_vx = ballState.current.vx
        params.ball_vy = ballState.current.vy
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
      const gd = gameDataRef.current
      const place = myPlaceRef.current
      const authority = isBallAuthorityRef.current

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
        gd.firstPaddleY,
        PADDLE_WIDTH,
        PADDLE_HEIGHT
      )

      // Second player (right)
      ctx.fillRect(
        PLAYFIELD_WIDTH - PADDLE_OFFSET_X - PADDLE_WIDTH,
        gd.secondPaddleY,
        PADDLE_WIDTH,
        PADDLE_HEIGHT
      )

      // Ball - first player uses physics simulation, others use interpolated display
      const ballX = authority ? ballState.current.x : ballDisplay.current.x
      const ballY = authority ? ballState.current.y : ballDisplay.current.y
      
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
      ctx.fillText(gd.firstScore.toString(), PLAYFIELD_WIDTH / 4, 20)
      
      // Second player score (right)
      ctx.fillText(gd.secondScore.toString(), (PLAYFIELD_WIDTH / 4) * 3, 20)
    }

    let rafId = 0
    let stopped = false

    const loop = () => {
      if (stopped) return
      render()
      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)

    return () => {
      stopped = true
      cancelAnimationFrame(rafId)
    }
  }, [])

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

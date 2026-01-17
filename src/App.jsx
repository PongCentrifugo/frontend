import { useState, useEffect, useRef } from 'react'
import { Centrifuge } from 'centrifuge'
import { API_CONFIG, CHANNELS } from './config'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import GameCanvas from './components/GameCanvas'
import LobbyScreen from './components/LobbyScreen'
import './App.css'

function App() {
  const [centrifuge, setCentrifuge] = useState(null)
  const [publicSub, setPublicSub] = useState(null)
  const [privateSub, setPrivateSub] = useState(null)
  
  const [gameState, setGameState] = useState('connecting') // connecting, lobby, playing, spectating
  const [lobbyStatus, setLobbyStatus] = useState({
    firstTaken: false,
    secondTaken: false,
    gameStarted: false,
  })
  
  const [myPlace, setMyPlace] = useState(null) // 'first' or 'second'
  const myPlaceRef = useRef(null) // Keep ref in sync with state
  const [myUserId, setMyUserId] = useState(() => 'user_' + Math.random().toString(36).substr(2, 9))
  
  const [gameData, setGameData] = useState({
    firstPaddleY: 115,
    secondPaddleY: 115,
    firstScore: 0,
    secondScore: 0,
    ballX: 187.5,
    ballY: 123,
    ballVx: 0,
    ballVy: 0,
    ballAuthorityPlace: null, // who is currently broadcasting ball state
    ballAuthorityAtMs: 0,
  })

  // Keep ref in sync with state
  useEffect(() => {
    myPlaceRef.current = myPlace
  }, [myPlace])

  // Initialize Centrifugo connection
  useEffect(() => {
    const client = new Centrifuge(API_CONFIG.CENTRIFUGO_URL, {
      // Anonymous connection
    })

    client.on('connected', () => {
      console.log('Connected to Centrifugo')
    })

    client.on('disconnected', () => {
      console.log('Disconnected from Centrifugo')
    })

    client.on('error', (ctx) => {
      console.error('Centrifugo client error:', ctx)
    })

    setCentrifuge(client)
    client.connect()

    return () => {
      client.disconnect()
    }
  }, [])

  // Subscribe to public channel
  useEffect(() => {
    if (!centrifuge) return

    const refreshStatus = async () => {
      try {
        const res = await fetch(`${API_CONFIG.BACKEND_URL}/v1/games/status`, { method: 'GET' })
        if (!res.ok) return
        const status = await res.json()

        setLobbyStatus({
          firstTaken: !!status.first_connected,
          secondTaken: !!status.second_connected,
          gameStarted: !!status.game_started,
        })
        setGameData(prev => ({
          ...prev,
          firstPaddleY: status.first_paddle_y ?? prev.firstPaddleY,
          secondPaddleY: status.second_paddle_y ?? prev.secondPaddleY,
          firstScore: status.first_score ?? prev.firstScore,
          secondScore: status.second_score ?? prev.secondScore,
        }))

        const place = myPlaceRef.current
        if (status.game_started) {
          setGameState(place ? 'playing' : 'spectating')
        } else {
          setGameState('lobby')
        }
      } catch (e) {
        // ignore
      }
    }

    // Check if subscription already exists
    let sub = centrifuge.getSubscription(CHANNELS.PUBLIC)
    if (sub) {
      setPublicSub(sub)
      
      // Fetch history for existing subscription
      sub.history({ limit: 10 }).then(historyResult => {
        const history = historyResult.publications || []
        processHistory(history)
        // History might not include game_started if it's old/evicted. Ask backend for current status.
        refreshStatus()
      }).catch(err => {
        console.error('Failed to get history for existing sub:', err)
        refreshStatus()
      })
      return
    }

    sub = centrifuge.newSubscription(CHANNELS.PUBLIC, {
      // No special options needed, we'll fetch history after subscribing
    })

    sub.on('subscribed', async () => {
      console.log('Subscribed to public channel')
      
      // Fetch history after subscribing
      try {
        const historyResult = await sub.history({ limit: 10 })
        const history = historyResult.publications || []
        processHistory(history)
        refreshStatus()
      } catch (err) {
        console.error('Failed to get history:', err)
        // Fallback to backend status for late-joining spectators.
        refreshStatus()
      }
    })

    sub.on('publication', (ctx) => {
      handlePublicEvent(ctx.data)
    })

    sub.on('error', (ctx) => {
      console.error('Subscription error:', ctx)
    })

    sub.subscribe()
    setPublicSub(sub)

    // Don't unsubscribe on cleanup - let the Centrifuge SDK manage resubscription
  }, [centrifuge])

  const processHistory = (history) => {
    const currentPlace = myPlaceRef.current
    let firstTaken = false
    let secondTaken = false
    let gameStarted = false
    let latestScores = { first: 0, second: 0 }
    let latestPositions = { first: 115, second: 115 }

    history.forEach(pub => {
      const event = pub.data
      
      if (event.type === 'player_joined') {
        if (event.data.place === 'first') firstTaken = true
        if (event.data.place === 'second') secondTaken = true
      }
      
      if (event.type === 'player_left') {
        if (event.data.place === 'first') firstTaken = false
        if (event.data.place === 'second') secondTaken = false
      }
      
      if (event.type === 'game_started') {
        gameStarted = true
      }
      
      if (event.type === 'goal') {
        latestScores.first = event.data.first_score
        latestScores.second = event.data.second_score
      }
      
      if (event.type === 'move') {
        if (event.data.place === 'first') {
          latestPositions.first = event.data.paddle_y
        } else {
          latestPositions.second = event.data.paddle_y
        }
      }
      
      if (event.type === 'game_ended') {
        gameStarted = false
        firstTaken = false
        secondTaken = false
        latestScores = { first: 0, second: 0 }
      }
    })

    setLobbyStatus({ firstTaken, secondTaken, gameStarted })
    setGameData(prev => ({
      ...prev,
      firstScore: latestScores.first,
      secondScore: latestScores.second,
      firstPaddleY: latestPositions.first,
      secondPaddleY: latestPositions.second,
    }))

    // Set game state based on history
    if (gameStarted) {
      // Game is active
      if (!currentPlace) {
        setGameState('spectating')
      } else {
        setGameState('playing')
      }
    } else {
      // No active game - stay in lobby
      setGameState('lobby')
    }
  }

  const handlePublicEvent = (event) => {
    switch (event.type) {
      case 'player_joined':
        setLobbyStatus(prev => ({
          ...prev,
          firstTaken: event.data.place === 'first' ? true : prev.firstTaken,
          secondTaken: event.data.place === 'second' ? true : prev.secondTaken,
        }))
        break
        
      case 'player_left':
        setLobbyStatus(prev => ({
          ...prev,
          firstTaken: event.data.place === 'first' ? false : prev.firstTaken,
          secondTaken: event.data.place === 'second' ? false : prev.secondTaken,
          gameStarted: false,
        }))
        setGameState('lobby')
        break
        
      case 'game_started':
        const place = myPlaceRef.current
        setLobbyStatus(prev => ({ ...prev, gameStarted: true }))
        if (!place) {
          setGameState('spectating')
        } else {
          setGameState('playing')
        }
        break
        
      case 'move':
        setGameData(prev => {
          const updated = {
            ...prev,
            firstPaddleY: event.data.place === 'first' ? event.data.paddle_y : prev.firstPaddleY,
            secondPaddleY: event.data.place === 'second' ? event.data.paddle_y : prev.secondPaddleY,
          }
          
          // Sync ball position from whoever is broadcasting ball state.
          if (event.data.ball_x !== undefined && event.data.ball_y !== undefined) {
            updated.ballX = event.data.ball_x
            updated.ballY = event.data.ball_y
            if (event.data.ball_vx !== undefined) updated.ballVx = event.data.ball_vx
            if (event.data.ball_vy !== undefined) updated.ballVy = event.data.ball_vy
            updated.ballAuthorityPlace = event.data.place
            updated.ballAuthorityAtMs = Date.now()
          }
          
          return updated
        })
        break
        
      case 'goal':
        setGameData(prev => ({
          ...prev,
          firstScore: event.data.first_score,
          secondScore: event.data.second_score,
        }))
        break
        
      case 'game_ended':
        console.log('Game ended, cleaning up...')
        
        // Cleanup private subscription if exists
        if (privateSub && centrifuge) {
          privateSub.unsubscribe()
          centrifuge.removeSubscription(privateSub)
        }
        
        // Reset connection to anonymous
        if (centrifuge) {
          centrifuge.disconnect()
          centrifuge.setToken('')  // Clear token
          centrifuge.connect()      // Reconnect anonymously
        }
        
        setLobbyStatus({ firstTaken: false, secondTaken: false, gameStarted: false })
        setMyPlace(null)
        myPlaceRef.current = null
        setPrivateSub(null)
        setGameState('lobby')
        setGameData(prev => ({
          ...prev,
          firstScore: 0,
          secondScore: 0,
          firstPaddleY: 115,
          secondPaddleY: 115,
          ballAuthorityPlace: null,
          ballAuthorityAtMs: 0,
        }))
        break
    }
  }

  const joinGame = async (place) => {
    try {
      const response = await fetch(`${API_CONFIG.BACKEND_URL}/v1/games/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${myUserId}`,
        },
        body: JSON.stringify({ place }),
      })

      if (!response.ok) {
        const error = await response.text()
        alert(`Failed to join: ${error}`)
        return
      }

      const data = await response.json()
      console.log('Joined as', place, data)

      setMyPlace(place)
      myPlaceRef.current = place  // Update ref immediately

      // Cleanup any existing private subscription first
      const existingPrivateSub = centrifuge.getSubscription(data.private_channel)
      if (existingPrivateSub) {
        console.log('Removing existing private subscription')
        existingPrivateSub.unsubscribe()
        centrifuge.removeSubscription(existingPrivateSub)
      }
      
      // Disconnect, set token, and reconnect with authenticated user
      centrifuge.disconnect()
      centrifuge.setToken(data.connection_token)
      
      // Subscribe to private channel with subscription token
      const privateSub = centrifuge.newSubscription(data.private_channel, {
        token: data.subscribe_token,
      })

      privateSub.on('subscribed', () => {
        console.log('Subscribed to private channel')
      })

      privateSub.on('publication', (ctx) => {
        console.log('Private event:', ctx.data)
        handlePrivateEvent(ctx.data)
      })

      privateSub.subscribe()
      setPrivateSub(privateSub)
      
      // Reconnect with new token
      centrifuge.connect()

    } catch (error) {
      console.error('Join error:', error)
      alert('Failed to join game')
    }
  }

  const handlePrivateEvent = (event) => {
    if (event.type === 'enemy_move') {
      // Update enemy paddle position
      setGameData(prev => ({
        ...prev,
        firstPaddleY: myPlace === 'second' ? event.enemy_paddle_y : prev.firstPaddleY,
        secondPaddleY: myPlace === 'first' ? event.enemy_paddle_y : prev.secondPaddleY,
      }))
    }
  }

  const leaveGame = async () => {
    try {
      await fetch(`${API_CONFIG.BACKEND_URL}/v1/games/leave`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${myUserId}`,
        },
      })
      
      // Cleanup private subscription
      if (privateSub && centrifuge) {
        privateSub.unsubscribe()
        centrifuge.removeSubscription(privateSub)
      }
      
      // Reset connection to anonymous
      if (centrifuge) {
        centrifuge.disconnect()
        centrifuge.setToken('')
        centrifuge.connect()
      }
      
      setMyPlace(null)
      myPlaceRef.current = null
      setPrivateSub(null)
      setGameState('lobby')
    } catch (error) {
      console.error('Leave error:', error)
    }
  }

  return (
    <div className="app">
      <Navbar />
      
      {gameState === 'connecting' && (
        <div className="connecting">Connecting...</div>
      )}
      
      {gameState === 'lobby' && (
        <LobbyScreen
          lobbyStatus={lobbyStatus}
          onJoin={joinGame}
        />
      )}
      
      {(gameState === 'playing' || gameState === 'spectating') && (
        <GameCanvas
          gameData={gameData}
          myPlace={myPlace}
          isSpectator={gameState === 'spectating'}
          centrifuge={centrifuge}
          myUserId={myUserId}
          onLeave={leaveGame}
        />
      )}
      
      <Footer />
    </div>
  )
}

export default App

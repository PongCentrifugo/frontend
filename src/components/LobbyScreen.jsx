import './LobbyScreen.css'

export default function LobbyScreen({ lobbyStatus, onJoin }) {
  const { firstTaken, secondTaken, gameStarted } = lobbyStatus

  return (
    <div className="lobby">
      <h1 className="lobby-title">PONG</h1>
      
      <div className="lobby-status">
        {!firstTaken && !secondTaken && (
          <p>Lobby is empty. Choose your place:</p>
        )}
        
        {(firstTaken || secondTaken) && !gameStarted && (
          <p>Waiting for {firstTaken ? 'second' : 'first'} player...</p>
        )}
      </div>
      
      <div className="lobby-buttons">
        <button
          className="place-button"
          onClick={() => onJoin('first')}
          disabled={firstTaken}
        >
          {firstTaken ? '⬛ FIRST (TAKEN)' : '⬜ PLAY AS FIRST'}
        </button>
        
        <button
          className="place-button"
          onClick={() => onJoin('second')}
          disabled={secondTaken}
        >
          {secondTaken ? '⬛ SECOND (TAKEN)' : '⬜ PLAY AS SECOND'}
        </button>
      </div>
      
      <div className="lobby-info">
        <p>First to 10 goals wins</p>
        <p>Use ↑/↓ arrows to move your paddle</p>
      </div>
    </div>
  )
}

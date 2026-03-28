import React, { useState, useCallback } from "react";
import Canvas from "./Canvas.jsx";

const API = "";

export default function App() {
  const [screen, setScreen] = useState("setup");
  const [namesInput, setNamesInput] = useState("Prashanth, Alex, Jordan, Sam");
  const [game, setGame] = useState(null);
  const [turn, setTurn] = useState(null);
  const [canvasImage, setCanvasImage] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [roundEnd, setRoundEnd] = useState(null);
  const [gameEnd, setGameEnd] = useState(null);
  const [aiBubble, setAiBubble] = useState(null);
  const [logOpen, setLogOpen] = useState(false);

  const addLog = useCallback((msg) => {
    setLogs((prev) => [...prev.slice(-40), { id: Date.now() + Math.random(), text: msg }]);
  }, []);

  async function startGame() {
    const names = namesInput.split(",").map((n) => n.trim()).filter(Boolean);
    if (names.length < 2) return alert("Need at least 2 players");

    const res = await fetch(`${API}/api/new-game`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ players: names }),
    });
    const data = await res.json();

    setGame(data);
    setCanvasImage(null);
    setLogs([]);
    setLeaderboard(data.players.map((p, i) => ({ rank: i + 1, ...p })));
    setRoundEnd(null);
    setGameEnd(null);
    setLastResult(null);
    setAiBubble(null);
    addLog(`Round ${data.round} — word is "${data.word}"`);
    setScreen("game");

    fetchNextTurn();
  }

  async function fetchNextTurn() {
    const res = await fetch(`${API}/api/next-turn`, { method: "POST" });
    const data = await res.json();

    if (data.type === "round-end") {
      handleRoundEnd(data);
      return;
    }
    if (data.type === "game-end") {
      handleGameEnd(data);
      return;
    }

    setTurn(data);
    setProcessing(false);
    addLog(`${data.player.name}'s turn (${data.turnTime}s)`);
  }

  async function submitStroke(imageData, pixelCount) {
    if (!turn) return;
    setProcessing(true);
    setAiBubble(null);
    addLog(`${turn.player.name} drew ${pixelCount}px`);

    const res = await fetch(`${API}/api/submit-stroke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId: turn.player.id,
        canvasImage: imageData,
        pixelCount,
      }),
    });
    const data = await res.json();

    setLastResult(data);
    setCanvasImage(data.canvasImage || canvasImage);
    if (data.logs) data.logs.forEach((l) => addLog(l));
    if (data.players) {
      setLeaderboard(
        [...data.players].sort((a, b) => b.score - a.score).map((p, i) => ({ rank: i + 1, ...p }))
      );
    }

    if (data.type === "safe") {
      const bubbleText = data.blindPassed
        ? `Hmm... not sure yet (${data.blindConfidence}%)`
        : `Hmm... is that a ${data.blindGuess}? (${data.blindConfidence}%)`;
      setAiBubble({ text: bubbleText, valid: true, reason: data.informedReason });
    } else if (data.type === "eliminated") {
      const bubbleText = data.judge === "blind"
        ? `I know! It's a ${data.blindGuess}!`
        : `That doesn't look right...`;
      setAiBubble({ text: bubbleText, valid: false, reason: data.reason });
      addLog(`${data.player.name} ELIMINATED — ${data.reason}`);
    }

    setProcessing(false);

    if (data.roundEnd) {
      setTimeout(() => handleRoundEnd(data.roundEnd), 2500);
      return;
    }

    setTimeout(() => fetchNextTurn(), 1800);
  }

  function handleRoundEnd(data) {
    setRoundEnd(data);
    setTurn(null);
    if (data.leaderboard) setLeaderboard(data.leaderboard);
    if (data.winner) {
      addLog(`Round over! ${data.winner.name} is the last one standing!`);
    } else {
      addLog(`Round over! No winner.`);
    }
  }

  async function nextRound() {
    setRoundEnd(null);
    setCanvasImage(null);
    setLastResult(null);
    setAiBubble(null);

    const res = await fetch(`${API}/api/next-round`, { method: "POST" });
    const data = await res.json();

    if (data.type === "game-end") {
      handleGameEnd(data);
      return;
    }

    setGame(data);
    addLog(`Round ${data.round} — word is "${data.word}"`);
    fetchNextTurn();
  }

  function handleGameEnd(data) {
    setGameEnd(data);
    setScreen("results");
  }

  // ─── SETUP SCREEN ─────────────────────────────────────
  if (screen === "setup") {
    return (
      <div className="screen setup-screen">
        <div className="setup-card">
          <h1 className="logo">DRAW<span>BLUFF</span></h1>
          <p className="tagline">Draw to survive. Don't let the AI guess.</p>
          <div className="setup-fields">
            <label>Player names (comma separated)</label>
            <input
              value={namesInput}
              onChange={(e) => setNamesInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startGame()}
              placeholder="Alex, Sam, Priya"
            />
            <button className="btn-primary" onClick={startGame}>Start Game</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── RESULTS SCREEN ────────────────────────────────────
  if (screen === "results") {
    const lb = gameEnd?.leaderboard || leaderboard;
    return (
      <div className="screen results-screen">
        <div className="results-card">
          <h1 className="logo">DRAW<span>BLUFF</span></h1>
          <h2>Final Standings</h2>
          <div className="lb-final">
            {lb.map((p) => (
              <div key={p.id} className={`lb-row ${p.rank === 1 ? "winner" : ""}`}>
                <span className="lb-rank">#{p.rank}</span>
                <span className="lb-name">{p.name}</span>
                <span className="lb-score">{p.score}</span>
              </div>
            ))}
          </div>
          <button className="btn-primary" onClick={() => { setScreen("setup"); setGameEnd(null); }}>
            Play Again
          </button>
        </div>
      </div>
    );
  }

  // ─── GAME SCREEN ───────────────────────────────────────
  const dangerPct = lastResult?.blindConfidence || 0;
  const dangerColor = dangerPct < 30 ? "#4ade80" : dangerPct < 55 ? "#e8b830" : dangerPct < 75 ? "#f97316" : "#ef4444";
  const dangerLabel = dangerPct < 30 ? "SAFE" : dangerPct < 55 ? "WARMING UP" : dangerPct < 75 ? "GETTING HOT" : "CRITICAL";
  const informedScore = lastResult?.informedScore || 0;
  const isMyTurn = !!turn && !processing;

  return (
    <div className="screen game-screen">
      {/* HEADER */}
      <header className="game-header">
        <div className="header-left">
          <h1 className="logo sm">DRAW<span>BLUFF</span></h1>
          <span className="badge-pill">Round {game?.round || 0} / {game?.totalRounds || 5}</span>
        </div>
        <div className="header-center">
          <div className="word-box">{game?.word?.toUpperCase() || "..."}</div>
        </div>
        <div className="header-right">
          <span className="badge-pill">Turn {turn?.turnNumber || 0} / {turn?.maxTurns || 30}</span>
        </div>
      </header>

      {/* BODY */}
      <div className="game-body">
        {/* LEFT SIDEBAR */}
        <aside className="sidebar left">
          <div className="panel">
            <h3>Players</h3>
            {(game?.players || []).map((p) => (
              <div key={p.id} className={`player-row ${!p.alive ? "dead" : ""} ${turn?.player?.id === p.id ? "active-turn" : ""}`}>
                <span className={`dot ${p.alive ? "alive" : "eliminated"}`} />
                <span className="pname">{p.name}</span>
                {turn?.player?.id === p.id && p.alive && <span className="you-badge">YOU</span>}
                <span className="pscore">{p.roundPixels || 0}</span>
              </div>
            ))}
          </div>

          <div className="panel">
            <button className="btn-flag">Flag invalid stroke</button>
          </div>

          <div className="panel">
            <h3>AI Danger</h3>
            <div className="meter-track">
              <div className="meter-fill" style={{ width: `${dangerPct}%`, backgroundColor: dangerColor, boxShadow: dangerPct > 55 ? `0 0 10px ${dangerColor}` : "none" }} />
            </div>
            <div className="meter-info">
              <span className="meter-pct" style={{ color: dangerColor }}>{dangerPct}%</span>
              <span className="meter-label" style={{ color: dangerColor }}>{dangerLabel}</span>
            </div>
          </div>
        </aside>

        {/* CENTER - CANVAS */}
        <main className="center-col">
          {processing && (
            <div className="processing-overlay">
              <div className="spinner" />
              <span>AI is judging...</span>
            </div>
          )}

          <Canvas
            active={isMyTurn}
            canvasImage={canvasImage}
            onSubmit={submitStroke}
            turnTime={turn?.turnTime || 15}
            playerName={turn?.player?.name || ""}
          />

          {aiBubble && (
            <div className="ai-bubble-row">
              <div className="ai-avatar">AI</div>
              <div className="ai-bubble">
                <span>{aiBubble.text}</span>
              </div>
              <div className={`ai-verdict ${aiBubble.valid ? "valid" : "invalid"}`}>
                {aiBubble.valid ? "Valid stroke" : "Eliminated!"}
              </div>
            </div>
          )}

          {roundEnd && (
            <div className="round-overlay">
              <h2>Round {roundEnd.round} Over!</h2>
              {roundEnd.winner ? (
                <p>{roundEnd.winner.name} is the last one standing!</p>
              ) : (
                <p>No winner this round.</p>
              )}
              <p className="word-reveal">The word was: <strong>{roundEnd.word}</strong></p>
              <button className="btn-primary" onClick={nextRound}>Next Round</button>
            </div>
          )}
        </main>

        {/* RIGHT SIDEBAR */}
        <aside className="sidebar right">
          <div className="panel">
            <h3>Leaderboard</h3>
            {leaderboard.map((p) => (
              <div key={p.id} className="lb-row-sm">
                <span className="lb-rank-sm">#{p.rank}</span>
                <span className="lb-name-sm">{p.name}</span>
                <span className="lb-score-sm">{p.score}</span>
              </div>
            ))}
          </div>

          <div className="panel log-panel">
            <div className="log-header" onClick={() => setLogOpen(o => !o)}>
              <h3>Game Log</h3>
              <span className={`log-chevron ${logOpen ? "open" : ""}`}>&#9660;</span>
            </div>
            {logOpen && (
              <div className="log-entries">
                {logs.map((l) => (
                  <div key={l.id} className="log-entry">{l.text}</div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import Game from "./gameManager.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "../client/dist")));

let game = new Game();

app.post("/api/new-game", async (req, res) => {
  const { players, rounds } = req.body;
  const names = (players || []).map((n) => n.trim()).filter(Boolean);
  if (names.length < 2) return res.status(400).json({ error: "Need at least 2 players." });

  game = new Game();
  game.totalRounds = rounds || 5;
  game.addPlayers(names);

  const result = await game.startRound();
  res.json(result);
});

app.post("/api/next-turn", (req, res) => {
  const result = game.getNextTurn();
  res.json(result);
});

app.post("/api/submit-stroke", async (req, res) => {
  const { playerId, canvasImage, pixelCount } = req.body;
  const result = await game.handleStroke(playerId, canvasImage, pixelCount);

  const alive = game.getAlivePlayers();
  if ((result.type === "eliminated" || result.type === "safe") && alive.length <= 1) {
    const roundEnd = game.endRound(alive[0] || null);
    res.json({ ...result, roundEnd });
    return;
  }

  res.json(result);
});

app.post("/api/next-round", async (req, res) => {
  const result = await game.startRound();
  res.json(result);
});

app.get("/api/state", (req, res) => {
  res.json({
    state: game.state,
    players: game.players,
    round: game.currentRound,
    totalRounds: game.totalRounds,
    word: game.word,
    leaderboard: game.getLeaderboard(),
    logs: game.logs,
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/dist/index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`DrawBluff v2 running on http://localhost:${PORT}`);
});

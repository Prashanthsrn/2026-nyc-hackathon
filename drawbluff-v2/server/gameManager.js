import { generateWord, judgeInformed, judgeBlind, doesGuessMatch } from "./geminiService.js";

class Game {
  constructor() {
    this.players = [];
    this.state = "setup";
    this.currentRound = 0;
    this.totalRounds = 5;
    this.word = null;
    this.currentTurnIndex = 0;
    this.turnNumber = 0;
    this.maxTurnsPerRound = 30;
    this.baseTurnTime = 15;
    this.minTurnTime = 6;
    this.canvasData = null;
    this.logs = [];
  }

  addPlayers(names) {
    this.players = names.map((name, i) => ({
      id: i,
      name,
      score: 0,
      roundPixels: 0,
      alive: true,
    }));
  }

  getAlivePlayers() {
    return this.players.filter((p) => p.alive);
  }

  getTurnTime() {
    const reduction = Math.floor(this.turnNumber / 3) * 2;
    return Math.max(this.minTurnTime, this.baseTurnTime - reduction);
  }

  getLeaderboard() {
    return [...this.players]
      .sort((a, b) => b.score - a.score)
      .map((p, i) => ({ rank: i + 1, ...p }));
  }

  async startRound() {
    this.currentRound++;
    if (this.currentRound > this.totalRounds) {
      this.state = "ended";
      return { type: "game-end", leaderboard: this.getLeaderboard() };
    }

    this.word = await generateWord();
    this.turnNumber = 0;
    this.canvasData = null;
    this.logs = [];

    for (const p of this.players) {
      p.alive = true;
      p.roundPixels = 0;
    }

    const alive = this.getAlivePlayers();
    this.currentTurnIndex = 0;
    this.state = "playing";

    return {
      type: "round-start",
      round: this.currentRound,
      totalRounds: this.totalRounds,
      word: this.word,
      players: this.players,
    };
  }

  getNextTurn() {
    const alive = this.getAlivePlayers();
    if (alive.length <= 1) {
      return this.endRound(alive[0] || null);
    }

    if (this.turnNumber >= this.maxTurnsPerRound) {
      const leastPixels = alive.reduce((min, p) =>
        p.roundPixels < min.roundPixels ? p : min
      );
      leastPixels.alive = false;
      this.logs.push(`${leastPixels.name} eliminated — least ink contributed`);

      const remaining = this.getAlivePlayers();
      if (remaining.length <= 1) {
        return this.endRound(remaining[0] || null);
      }
    }

    let currentPlayer = null;
    let attempts = 0;
    while (attempts < this.players.length) {
      const idx = this.currentTurnIndex % this.players.length;
      this.currentTurnIndex++;
      if (this.players[idx].alive) {
        currentPlayer = this.players[idx];
        break;
      }
      attempts++;
    }

    if (!currentPlayer) return this.endRound(null);

    this.turnNumber++;
    return {
      type: "turn-start",
      player: currentPlayer,
      turnNumber: this.turnNumber,
      turnTime: this.getTurnTime(),
      maxTurns: this.maxTurnsPerRound,
    };
  }

  async handleStroke(playerId, canvasImage, pixelCount) {
    const player = this.players.find((p) => p.id === playerId);
    if (!player || !player.alive) return { type: "error", message: "Invalid player" };

    player.roundPixels += pixelCount || 0;
    this.logs.push(`${player.name} drew ${pixelCount || 0}px`);

    const [informed, blind] = await Promise.all([
      judgeInformed(canvasImage, this.word),
      judgeBlind(canvasImage),
    ]);

    this.logs.push(`AI: ${informed.valid ? "valid stroke" : "INVALID — " + informed.reason}`);

    if (!informed.valid) {
      player.alive = false;
      return {
        type: "eliminated",
        player,
        reason: `Invalid stroke: ${informed.reason}`,
        judge: "informed",
        informedScore: informed.score,
        informedReason: informed.reason,
        canvasImage: this.canvasData,
        logs: this.logs,
        players: this.players,
      };
    }

    this.canvasData = canvasImage;

    if (blind.passed) {
      this.logs.push(`Detector: ${blind.confidence}% — pass`);
    } else {
      this.logs.push(`Detector: ${blind.confidence}% confident — "${blind.guess}"`);
    }

    const matched = !blind.passed && doesGuessMatch(blind.guess, this.word);

    if (matched) {
      player.alive = false;
      this.logs.push(`${player.name} ELIMINATED — AI guessed "${blind.guess}"`);
      return {
        type: "eliminated",
        player,
        reason: `AI guessed "${blind.guess}" — correct!`,
        judge: "blind",
        informedScore: informed.score,
        informedReason: informed.reason,
        blindGuess: blind.guess,
        blindConfidence: blind.confidence,
        canvasImage,
        logs: this.logs,
        players: this.players,
      };
    }

    player.score += 1;
    this.logs.push(`${player.name} survived — +1 pt`);

    return {
      type: "safe",
      player,
      informedScore: informed.score,
      informedReason: informed.reason,
      blindGuess: blind.guess,
      blindConfidence: blind.confidence,
      blindPassed: blind.passed,
      canvasImage,
      logs: this.logs,
      players: this.players,
    };
  }

  endRound(winner) {
    this.state = "between-rounds";

    return {
      type: "round-end",
      round: this.currentRound,
      word: this.word,
      winner: winner ? { name: winner.name } : null,
      players: this.players,
      leaderboard: this.getLeaderboard(),
      logs: this.logs,
    };
  }
}

export default Game;
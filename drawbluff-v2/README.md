# DrawBluff v2

A pass-and-play drawing game with dual AI judges powered by Gemini 2.5 Flash. 
Team Members : Prashanth Sreenivasan, Vaibhav rouduri

## How It Works

All players see the same word. Take turns adding strokes to a shared canvas. Two AI judges evaluate every stroke:

- **Judge 1 (Informed)**: Knows the word. Checks if your stroke is valid. Invalid = eliminated immediately.
- **Judge 2 (Blind)**: Doesn't know the word. Tries to guess what's being drawn. Correct guess = eliminated immediately.

Last player standing wins the round and keeps all pixel points + survival bonus. Play 5 rounds — highest total score wins.

## Run

```bash
export GEMINI_API_KEY="your-key-here"
bash start.sh
```

Open `http://localhost:3000`

## Stack

- **Server**: Node.js, Express, REST API
- **Client**: React 18, Vite, HTML5 Canvas
- **AI**: Google Gemini 2.5 Flash (word gen, validation, detection)

## Project Structure

```
server/
  index.js          — Express server with REST endpoints
  gameManager.js    — Game state: rounds, turns, elimination, scoring
  geminiService.js  — Two-judge Gemini calls + word generation
client/
  src/App.jsx       — All screens: setup, game, results
  src/Canvas.jsx    — Drawing canvas with timer
  src/styles.css    — Charcoal + yellow theme
```

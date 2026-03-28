import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const FALLBACK_WORDS = [
  "guitar", "elephant", "pizza", "bicycle", "apple",
  "tree", "cat", "airplane", "shoe", "fish",
  "house", "flower", "sun", "clock", "umbrella",
  "rocket", "penguin", "castle", "mushroom", "boat",
];

async function retry(fn, attempts = 2) {
  for (let i = 0; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts) throw err;
      const wait = Math.min(2000 * (i + 1), 6000);
      console.warn(`Gemini retry ${i + 1} after ${wait}ms:`, err.message);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

export async function generateWord() {
  try {
    const result = await retry(() =>
      model.generateContent(
        "Give me a single common, easily drawable noun (an object, animal, or food). " +
        "Respond with ONLY the word in lowercase, nothing else. " +
        "Pick something random and different each time."
      )
    );
    const word = result.response.text()?.trim().toLowerCase();
    if (word && word.length < 20 && !word.includes(" ")) return word;
    return FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)];
  } catch {
    return FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)];
  }
}

export async function judgeInformed(canvasBase64, word) {
  const imageData = canvasBase64.replace(/^data:image\/\w+;base64,/, "");

  try {
    const result = await retry(() =>
      model.generateContent([
        { inlineData: { mimeType: "image/png", data: imageData } },
        {
          text:
            `You are Judge 1 in a drawing game. You KNOW the secret word is "${word}". ` +
            `Look at this drawing and evaluate two things:\n` +
            `1. VALID: Is the drawing progressing toward depicting "${word}"? Be generous with early/partial drawings. Only mark invalid if clearly unrelated.\n` +
            `2. SCORE: Rate recognizability as "${word}" from 0-100. 0=blank/random, 50=partially recognizable, 100=perfectly clear.\n\n` +
            `Respond in EXACTLY this format:\n` +
            `VALID: true\nSCORE: 42\nREASON: one short sentence`,
        },
      ])
    );

    const text = result.response.text() || "";
    const isValid = text.toUpperCase().includes("VALID: TRUE");
    const scoreMatch = text.match(/SCORE:\s*(\d+)/i);
    const reasonMatch = text.match(/REASON:\s*(.+)/i);

    return {
      valid: isValid,
      score: scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[1]))) : 50,
      reason: reasonMatch ? reasonMatch[1].trim() : "No reason given",
    };
  } catch (err) {
    console.error("Judge 1 error:", err.message);
    return { valid: true, score: 50, reason: "AI had trouble analyzing — allowing stroke." };
  }
}

export async function judgeBlind(canvasBase64) {
  const imageData = canvasBase64.replace(/^data:image\/\w+;base64,/, "");

  try {
    const result = await retry(() =>
      model.generateContent([
        { inlineData: { mimeType: "image/png", data: imageData } },
        {
          text:
            `You are looking at a drawing. Try your absolute hardest to guess what single object is being drawn. ` +
            `Study every detail carefully. Give your best guess even if uncertain.\n\n` +
            `Respond in EXACTLY this format:\n` +
            `GUESS: [single word, or PASS if truly no idea]\n` +
            `CONFIDENCE: [number 0 to 100]`,
        },
      ])
    );

    const text = result.response.text() || "";
    const guessMatch = text.match(/GUESS:\s*(.+)/i);
    const confMatch = text.match(/CONFIDENCE:\s*(\d+)/i);

    const guess = guessMatch ? guessMatch[1].trim().toLowerCase() : "pass";
    const confidence = confMatch ? parseInt(confMatch[1]) : 0;

    return {
      guess: guess === "pass" ? null : guess,
      confidence: Math.min(100, Math.max(0, confidence)),
      passed: guess === "pass",
    };
  } catch (err) {
    console.error("Judge 2 error:", err.message);
    return { guess: null, confidence: 0, passed: true };
  }
}

export function doesGuessMatch(guess, word) {
  if (!guess) return false;
  const g = guess.toLowerCase().trim();
  const w = word.toLowerCase().trim();
  if (g === w) return true;
  if (g.includes(w) || w.includes(g)) return true;
  if (g + "s" === w || g === w + "s") return true;
  return false;
}
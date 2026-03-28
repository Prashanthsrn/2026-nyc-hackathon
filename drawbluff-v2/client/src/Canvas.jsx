import React, { useRef, useState, useEffect, useCallback } from "react";

export default function Canvas({ active, canvasImage, onSubmit, turnTime, playerName }) {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPos = useRef(null);
  const strokePixels = useRef(0);
  const [timeLeft, setTimeLeft] = useState(turnTime);
  const [hasDrawn, setHasDrawn] = useState(false);
  const timerRef = useRef(null);

  const W = 700;
  const H = 500;

  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");
    if (!canvasImage) {
      ctx.fillStyle = "#f5f0e8";
      ctx.fillRect(0, 0, W, H);
    }
  }, [canvasImage]);

  useEffect(() => {
    if (canvasImage) {
      const img = new Image();
      img.onload = () => {
        const ctx = canvasRef.current.getContext("2d");
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(img, 0, 0, W, H);
      };
      img.src = canvasImage;
    }
  }, [canvasImage]);

  useEffect(() => {
    setHasDrawn(false);
    strokePixels.current = 0;
    setTimeLeft(turnTime);
    clearInterval(timerRef.current);

    if (active) {
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current);
            doSubmit();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [active, turnTime, playerName]);

  function doSubmit() {
    const data = canvasRef.current.toDataURL("image/png");
    onSubmit(data, Math.floor(strokePixels.current));
  }

  function getPos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = W / rect.width;
    const sy = H / rect.height;
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (cx - rect.left) * sx, y: (cy - rect.top) * sy };
  }

  function startDraw(e) {
    if (!active) return;
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e);
  }

  function draw(e) {
    if (!isDrawing.current || !active) return;
    e.preventDefault();
    const pos = getPos(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.strokeStyle = "#2a2a2a";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    const dx = pos.x - lastPos.current.x;
    const dy = pos.y - lastPos.current.y;
    strokePixels.current += Math.sqrt(dx * dx + dy * dy) * 3;
    setHasDrawn(true);
    lastPos.current = pos;
  }

  function endDraw(e) {
    if (!isDrawing.current) return;
    e.preventDefault();
    isDrawing.current = false;
    lastPos.current = null;
  }

  function handleSubmit() {
    if (!hasDrawn) return;
    clearInterval(timerRef.current);
    doSubmit();
  }

  return (
    <div className="canvas-col">
      {active && (
        <div className="canvas-toolbar">
          <span className={`timer ${timeLeft <= 5 ? "urgent" : ""}`}>{timeLeft}s</span>
          <span className="your-turn">Your turn!</span>
          <button className="btn-submit" onClick={handleSubmit} disabled={!hasDrawn}>
            Submit stroke
          </button>
        </div>
      )}
      {!active && <div className="canvas-toolbar idle"><span className="waiting-turn">Waiting...</span></div>}
      <div className="canvas-frame">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className={`drawing-canvas ${active ? "active" : "locked"}`}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>
    </div>
  );
}
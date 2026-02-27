import confetti from "canvas-confetti";

export function celebrateTransaction() {
  // Burst of confetti from both sides
  const count = 200;
  const defaults = {
    origin: { y: 0.7 },
    zIndex: 9999,
  };

  function fire(particleRatio: number, opts: confetti.Options) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    });
  }

  // Fire confetti with different colors and directions
  fire(0.25, {
    spread: 26,
    startVelocity: 55,
    origin: { x: 0.2, y: 0.7 },
  });
  fire(0.2, {
    spread: 60,
    origin: { x: 0.5, y: 0.7 },
  });
  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8,
    origin: { x: 0.8, y: 0.7 },
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2,
    origin: { x: 0.5, y: 0.7 },
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 45,
    origin: { x: 0.5, y: 0.7 },
  });
}

export function celebrateOtter() {
  // Special otter-themed confetti with blue/cyan colors
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#06b6d4", "#0891b2", "#22d3ee", "#67e8f9", "#a5f3fc"],
    zIndex: 9999,
  });
}

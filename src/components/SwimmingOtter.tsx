"use client";

import { useState, useEffect } from "react";

interface Bubble {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
}

export function SwimmingOtter() {
  const [position, setPosition] = useState({ x: 10, y: 20 });
  const [direction, setDirection] = useState<"left" | "right">("right");
  const [isUnderwater, setIsUnderwater] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);

  // Swimming movement
  useEffect(() => {
    const swim = () => {
      setPosition((prev) => {
        // Random movement with bounds (slower, gentler movements)
        const newX = prev.x + (Math.random() - 0.45) * 3;
        const newY = prev.y + (Math.random() - 0.5) * 1.5;

        // Bounce off edges
        const clampedX = Math.max(5, Math.min(85, newX));
        const clampedY = Math.max(5, Math.min(70, newY));

        // Update direction based on movement
        if (newX > prev.x + 0.3) setDirection("right");
        else if (newX < prev.x - 0.3) setDirection("left");

        return { x: clampedX, y: clampedY };
      });
    };

    const interval = setInterval(swim, 400);
    return () => clearInterval(interval);
  }, []);

  // Occasional dive
  useEffect(() => {
    const dive = () => {
      if (Math.random() > 0.7) {
        setIsUnderwater(true);
        setTimeout(() => setIsUnderwater(false), 2000);
      }
    };

    const interval = setInterval(dive, 5000);
    return () => clearInterval(interval);
  }, []);

  // Bubble generation
  useEffect(() => {
    if (!isUnderwater) return;

    const createBubble = () => {
      const newBubble: Bubble = {
        id: Date.now(),
        x: position.x + (direction === "right" ? -2 : 2),
        y: position.y,
        size: Math.random() * 8 + 4,
        duration: Math.random() * 1 + 1,
      };
      setBubbles((prev) => [...prev.slice(-5), newBubble]);
    };

    const interval = setInterval(createBubble, 300);
    return () => clearInterval(interval);
  }, [isUnderwater, position, direction]);

  // Clean up old bubbles
  useEffect(() => {
    const cleanup = setInterval(() => {
      setBubbles((prev) => prev.filter((b) => Date.now() - b.id < 2000));
    }, 500);
    return () => clearInterval(cleanup);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-10">
      {/* Bubbles */}
      {bubbles.map((bubble) => (
        <div
          key={bubble.id}
          className="absolute rounded-full bg-cyan-200/40 animate-bubble"
          style={{
            left: `${bubble.x}%`,
            top: `${bubble.y}%`,
            width: bubble.size,
            height: bubble.size,
            animationDuration: `${bubble.duration}s`,
          }}
        />
      ))}

      {/* The Otter */}
      <div
        className="absolute transition-all ease-linear scale-150"
        style={{
          left: `${position.x}%`,
          top: `${position.y}%`,
          transitionDuration: "400ms",
          transform: `scaleX(${direction === "left" ? -1 : 1}) ${
            isUnderwater ? "translateY(20px)" : ""
          }`,
          opacity: isUnderwater ? 0.7 : 1,
        }}
      >
        <div className="relative">
          {/* Otter body */}
          <div className="relative animate-swim">
            {/* Main body */}
            <div className="relative">
              {/* Body */}
              <div className="w-16 h-10 bg-gradient-to-b from-amber-600 to-amber-700 rounded-[50%] relative">
                {/* Belly */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-6 bg-amber-100 rounded-[50%]" />
              </div>

              {/* Head */}
              <div className="absolute -top-4 -left-2 w-12 h-10 bg-gradient-to-b from-amber-600 to-amber-700 rounded-full">
                {/* Face */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-6 bg-amber-100 rounded-full" />

                {/* Ears */}
                <div className="absolute -top-1 left-1 w-3 h-3 bg-amber-700 rounded-full" />
                <div className="absolute -top-1 right-1 w-3 h-3 bg-amber-700 rounded-full" />

                {/* Eyes */}
                <div className="absolute top-3 left-2 w-2 h-2 bg-gray-900 rounded-full">
                  <div className="absolute top-0 left-0.5 w-1 h-1 bg-white rounded-full" />
                </div>
                <div className="absolute top-3 right-2 w-2 h-2 bg-gray-900 rounded-full">
                  <div className="absolute top-0 left-0.5 w-1 h-1 bg-white rounded-full" />
                </div>

                {/* Nose */}
                <div className="absolute top-5 left-1/2 -translate-x-1/2 w-2.5 h-2 bg-gray-900 rounded-full" />

                {/* Whiskers */}
                <div className="absolute top-6 left-0 w-3 h-px bg-gray-600 -rotate-12" />
                <div className="absolute top-7 left-0 w-3 h-px bg-gray-600 rotate-12" />
                <div className="absolute top-6 right-0 w-3 h-px bg-gray-600 rotate-12" />
                <div className="absolute top-7 right-0 w-3 h-px bg-gray-600 -rotate-12" />
              </div>

              {/* Tail */}
              <div className="absolute -right-6 top-2 w-8 h-4 bg-gradient-to-r from-amber-700 to-amber-600 rounded-full animate-tail" />

              {/* Front paws */}
              <div className="absolute bottom-0 left-2 w-3 h-4 bg-amber-800 rounded-full animate-paddle-left" />
              <div className="absolute bottom-0 right-2 w-3 h-4 bg-amber-800 rounded-full animate-paddle-right" />

              {/* Back flippers */}
              <div className="absolute -bottom-1 -right-2 w-4 h-3 bg-amber-800 rounded-full rotate-45 animate-flipper" />
            </div>

            {/* Water ripple effect */}
            {!isUnderwater && (
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                <div className="w-20 h-2 bg-cyan-300/30 rounded-full animate-ripple" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Styles */}
      <style jsx>{`
        @keyframes swim {
          0%, 100% {
            transform: rotate(-2deg) translateY(0);
          }
          50% {
            transform: rotate(2deg) translateY(-3px);
          }
        }

        @keyframes tail {
          0%, 100% {
            transform: rotate(-5deg);
          }
          50% {
            transform: rotate(5deg);
          }
        }

        @keyframes paddle-left {
          0%, 100% {
            transform: rotate(-20deg);
          }
          50% {
            transform: rotate(20deg);
          }
        }

        @keyframes paddle-right {
          0%, 100% {
            transform: rotate(20deg);
          }
          50% {
            transform: rotate(-20deg);
          }
        }

        @keyframes flipper {
          0%, 100% {
            transform: rotate(45deg) scaleY(1);
          }
          50% {
            transform: rotate(45deg) scaleY(0.8);
          }
        }

        @keyframes ripple {
          0%, 100% {
            transform: scaleX(1);
            opacity: 0.3;
          }
          50% {
            transform: scaleX(1.2);
            opacity: 0.5;
          }
        }

        @keyframes bubble {
          0% {
            transform: translateY(0) scale(1);
            opacity: 0.6;
          }
          100% {
            transform: translateY(-100px) scale(0.5);
            opacity: 0;
          }
        }

        .animate-swim {
          animation: swim 1.5s ease-in-out infinite;
        }

        .animate-tail {
          animation: tail 0.8s ease-in-out infinite;
        }

        .animate-paddle-left {
          animation: paddle-left 1s ease-in-out infinite;
        }

        .animate-paddle-right {
          animation: paddle-right 1s ease-in-out infinite;
        }

        .animate-flipper {
          animation: flipper 1.2s ease-in-out infinite;
        }

        .animate-ripple {
          animation: ripple 1.5s ease-in-out infinite;
        }

        .animate-bubble {
          animation: bubble 2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

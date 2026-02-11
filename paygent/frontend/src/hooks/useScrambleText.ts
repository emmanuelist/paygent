import { useState, useEffect, useRef } from "react";

const HEX_CHARS = "0123456789abcdef";

function randomHexChar() {
  return HEX_CHARS[Math.floor(Math.random() * HEX_CHARS.length)];
}

export function useScrambleText(text: string | undefined, duration = 600) {
  const [displayText, setDisplayText] = useState(text ?? "");
  const [isScrambling, setIsScrambling] = useState(false);
  const prevTextRef = useRef(text);

  useEffect(() => {
    const prev = prevTextRef.current;
    prevTextRef.current = text;

    if (!text || text === prev) {
      setDisplayText(text ?? "");
      return;
    }

    setIsScrambling(true);
    const length = text.length;
    const intervalMs = 30;
    const totalTicks = Math.floor(duration / intervalMs);
    let tick = 0;

    const interval = setInterval(() => {
      tick++;
      const resolvedCount = Math.floor((tick / totalTicks) * length);
      const chars = text.split("").map((char, i) =>
        i < resolvedCount ? char : randomHexChar()
      );
      setDisplayText(chars.join(""));

      if (tick >= totalTicks) {
        clearInterval(interval);
        setDisplayText(text);
        setIsScrambling(false);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [text, duration]);

  return { displayText, isScrambling };
}

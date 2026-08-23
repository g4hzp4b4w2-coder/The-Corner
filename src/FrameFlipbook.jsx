import { useState, useRef, useEffect } from "react";

// Plays a set of frames back-and-forth in a loop — a rough stop-motion
// replay of the action. Shared between the live video-analysis report and
// the journal entry card it gets saved into.
export default function FrameFlipbook({ frames, className }) {
  const [index, setIndex] = useState(0);
  const dirRef = useRef(1);

  useEffect(() => {
    if (!frames || frames.length < 2) return undefined;
    const id = setInterval(() => {
      setIndex((prev) => {
        let next = prev + dirRef.current;
        if (next >= frames.length - 1 || next <= 0) {
          dirRef.current *= -1;
          next = Math.max(0, Math.min(frames.length - 1, next));
        }
        return next;
      });
    }, 220);
    return () => clearInterval(id);
  }, [frames]);

  if (!frames || frames.length === 0) return null;
  return <img src={`data:image/jpeg;base64,${frames[index]}`} alt="" className={className || "w-full rounded-lg border border-neutral-800"} />;
}

import React, { useState, useEffect, useRef } from "react";

interface TimerProps {
  /** Total duration of the phase in seconds (e.g. 120). */
  timeSec: number;
  /** ISO timestamp written to the DB when the timed phase started. */
  startedAt: string;
  onFinish?: () => void;
}

const calcTimeLeft = (timeSec: number, startedAt: string): number => {
  const elapsed = Math.floor(
    (Date.now() - new Date(startedAt).getTime()) / 1000,
  );
  return Math.max(0, timeSec - elapsed);
};

const formatMMSS = (seconds: number): string => {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

const Timer: React.FC<TimerProps> = ({ timeSec, startedAt, onFinish }) => {
  const [timeLeft, setTimeLeft] = useState(() => calcTimeLeft(timeSec, startedAt));
  const finishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  // Re-sync whenever the anchor timestamp changes (new phase started).
  useEffect(() => {
    finishedRef.current = false;
    setTimeLeft(calcTimeLeft(timeSec, startedAt));
  }, [timeSec, startedAt]);

  useEffect(() => {
    if (timeLeft <= 0) {
      if (!finishedRef.current) {
        finishedRef.current = true;
        onFinishRef.current?.();
      }
      return;
    }

    const id = setInterval(() => {
      setTimeLeft(calcTimeLeft(timeSec, startedAt));
    }, 1000);

    return () => clearInterval(id);
  }, [timeLeft, timeSec, startedAt]);

  return (
    <div>
      <p className="w-72 rounded-lg bg-indigo-50 text-indigo-600 px-4 py-3 mt-3 text-center font-semibold shadow-sm">
        <span className="block text-sm text-indigo-500">Time left</span>
        <span className="block text-2xl font-bold mt-1">
          {formatMMSS(timeLeft)}
        </span>
      </p>
    </div>
  );
};

export default Timer;

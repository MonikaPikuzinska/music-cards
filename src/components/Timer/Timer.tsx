import React, { useState, useEffect, useRef } from "react";
import { calcTimeLeft, formatMMSS } from "../../utils/timerMath";

interface TimerProps {
  /** Total duration of the phase in seconds (e.g. 120). */
  timeSec: number;
  /** ISO timestamp written to the DB when the timed phase started. */
  startedAt: string;
  onFinish?: () => void;
}

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

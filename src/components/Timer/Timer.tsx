import React, { useState, useEffect, useRef, memo } from "react";
import { calcTimeLeft, formatMMSS } from "../../utils/timerMath";

interface TimerProps {
  /** Total duration of the phase in seconds (e.g. 120). */
  timeSec: number;
  /** ISO timestamp written to the DB when the timed phase started. */
  startedAt: string;
  onFinish?: () => void;
}

const Timer: React.FC<TimerProps> = ({ timeSec, startedAt, onFinish }) => {
  const [timeLeft, setTimeLeft] = useState(() =>
    calcTimeLeft(timeSec, startedAt),
  );
  const finishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    finishedRef.current = false;
    const tick = () => {
      const left = calcTimeLeft(timeSec, startedAt);
      setTimeLeft(left);
      if (left <= 0 && !finishedRef.current) {
        finishedRef.current = true;
        onFinishRef.current?.();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [timeSec, startedAt]);

  return (
    <div className="w-72 shrink-0">
      <p className="rounded-lg bg-indigo-50 text-indigo-600 px-4 py-3 mt-3 text-center font-semibold shadow-sm">
        <span className="block text-sm text-indigo-500">Time left</span>
        <span className="block text-2xl font-bold mt-1 tabular-nums">
          {formatMMSS(timeLeft)}
        </span>
      </p>
    </div>
  );
};

export default memo(Timer);

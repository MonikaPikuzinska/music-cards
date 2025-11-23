import React, { useState, useEffect } from "react";

const Timer: React.FC<{ timeSec: number }> = ({ timeSec }) => {
  const [timeLeft, setTimeLeft] = useState(timeSec);

  useEffect(() => {
    if (timeLeft <= 0) return; // stop timer at 0

    const timerId = setInterval(() => {
      setTimeLeft((prevTime) => prevTime - 1);
    }, 1000);

    return () => clearInterval(timerId);
  }, [timeLeft]);

  const formatSecondsToMMSS = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    // Pad with leading zeros if needed
    const minutesStr = minutes.toString().padStart(2, "0");
    const secondsStr = remainingSeconds.toString().padStart(2, "0");

    return `${minutesStr}:${secondsStr}`;
  };

  return (
    <div>
      <p className="w-72 rounded-lg bg-indigo-50 text-indigo-600 px-4 py-3 mt-3 text-center font-semibold shadow-sm">
        <span className="block text-sm text-indigo-500">Time left</span>
        <span className="block text-2xl font-bold mt-1">
          {formatSecondsToMMSS(timeLeft)}
        </span>
      </p>
    </div>
  );
};

export default Timer;

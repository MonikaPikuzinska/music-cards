import React, { useRef, useState } from "react";

const CopyLink: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const url = window.location.href;
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
    if (inputRef.current) {
      inputRef.current.select();
    }
  };

  return (
    <div className="flex flex-col items-start mt-4">
      <div className="flex items-center space-x-2">
        <input
          ref={inputRef}
          type="text"
          value={url}
          readOnly
          className="w-72 px-2 py-1 border border-indigo-300 rounded bg-gray-100 text-gray-400 focus:outline-none cursor-default"
        />
        <button
          onClick={handleCopy}
          className="px-3 py-1 bg-indigo-400 text-white rounded hover:bg-indigo-500 transition-colors"
        >
          Copy link
        </button>
      </div>
      {copied && (
        <span className="text-green-600 text-sm mt-2">
          Copied to clipboard!
        </span>
      )}
    </div>
  );
};

export default CopyLink;

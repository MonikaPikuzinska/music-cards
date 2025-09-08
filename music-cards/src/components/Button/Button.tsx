import React from "react";

interface ButtonProps {
  label: string;
  onClick: () => void;
}

const Button: React.FC<ButtonProps> = ({ label, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="bg-indigo-400 text-amber-50 px-3 cursor-pointer py-1 rounded"
    >
      {label}
    </button>
  );
};

export default Button;

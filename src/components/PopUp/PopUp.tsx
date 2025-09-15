import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";

interface PopUpProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const PopUp: React.FC<PopUpProps> = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-950/50 z-[1000]">
      <div className="bg-white rounded-xl shadow-2xl w-[50vw] h-[80vh] flex flex-col relative p-8 overflow-y-auto">
        <button
          className="absolute top-4 right-4 text-3xl text-gray-700 cursor-pointer hover:text-black focus:outline-none"
          onClick={onClose}
          aria-label="Close popup"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
        {children}
      </div>
    </div>
  );
};

export default PopUp;

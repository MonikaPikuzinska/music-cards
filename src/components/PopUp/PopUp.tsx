import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";

interface PopUpProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const PopUp: React.FC<PopUpProps> = ({ isOpen, onClose, children }) => {
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.classList.add("modal-open");
    document.body.style.overflow = "hidden";

    return () => {
      document.body.classList.remove("modal-open");
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-950/50"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative z-[9999] flex h-[80vh] w-[50vw] flex-col overflow-y-auto rounded-xl bg-white p-8 shadow-2xl">
        <button
          className="absolute top-4 right-4 cursor-pointer text-3xl text-gray-700 hover:text-black focus:outline-none"
          onClick={onClose}
          aria-label="Close popup"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
};

export default PopUp;

import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import Button from "../Button/Button";
import PopUp from "../PopUp/PopUp";
import Instruction from "../Instruction/Instruction";

export const NavBar = () => {
  const [openInstruction, setOpenInstruction] = useState(false);
  const { signOut, user } = useAuth();


  return (
    <nav className="fixed bg-gray-100 top-0 w-full">
      <PopUp isOpen={openInstruction} onClose={() => setOpenInstruction(false)}>
        <h2 className="text-xl font-bold mb-4">Instructions</h2>
        <Instruction />
      </PopUp>
      <div className="mx-auto px-4">
        <div className="flex items-center justify-end h-16">
          <div className="hidden md:flex items-center">
            {user ? (
              <div className="flex items-center space-x-4">
                {user.user_metadata?.avatar_url && (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="User Avatar"
                    className="w-8 h-8 rounded-full object-cover border-indigo-300 border-2"
                  />
                )}
                <button
                  onClick={signOut}
                  className="bg-gray-400 mt-3 cursor-pointer text-amber-50 px-3 py-1 rounded mr-5"
                >
                  Sign Out
                </button>
              </div>
            ) : null}
          </div>{" "}
          <Button
            onClick={() => setOpenInstruction(true)}
            label="Instruction"
          />
        </div>
      </div>
    </nav>
  );
};

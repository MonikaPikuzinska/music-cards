import React from "react";
import { useAuth } from "../../context/AuthContext";
import Button from "../Button/Button";

export const NavBar = () => {
  const { signOut, user } = useAuth();

  return (
    <nav className="fixed top-0 w-full">
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
            onClick={() => console.log("inst")}
            label="Instruction"
          />
        </div>
      </div>
    </nav>
  );
};

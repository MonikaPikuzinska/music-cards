import { Route, Routes } from "react-router";
import Login from "../pages/Login/Login";
import Game from "../pages/Game/Game";

function RoutesLinks() {
  return (
    <div className="min-h-screen bg-gray-100 transition-opacity duration-700 pt-20">
      {/* <Navbar /> */}
      <div className="container mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/game/:id" element={<Game />} />
        </Routes>
      </div>
    </div>
  );
}

export default RoutesLinks;

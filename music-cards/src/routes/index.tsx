import React, { Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import Login from "../pages/Login/Login";
import Game from "../pages/Game/Game";

const NoMatch = () => <h1>404</h1>;
const Loading = () => <>x</>;

const withLayout = (element: React.ReactNode) => (
    <Suspense fallback={<Loading />}>{element}</Suspense>
);

const routes = [
  {
    path: "/:id",
    element: <Login />,
  },{
    path: "/game/:id",
    element: <Game />,
  },
  {
    path: "*",
    element: <NoMatch />,
  },
];

export const router = createBrowserRouter(
  routes.map(({  element, ...rest }) => ({
    ...rest,
    element:  withLayout(element),
  })),
);

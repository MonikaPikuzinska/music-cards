import React, { Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import Login from "../pages/Login/Login";

const NoMatch = () => <h1>404</h1>;
const Loading = () => <>x</>;

const withLayout = (element: React.ReactNode) => (
    <Suspense fallback={<Loading />}>{element}</Suspense>
);

const routes = [
  {
    path: "/",
    element: <Login />,
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

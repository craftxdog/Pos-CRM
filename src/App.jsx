import { ThemeProvider } from "styled-components";
import { lazy, Suspense, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { AuthContextProvider } from "./context/AuthContent";
import { Dark, Light } from "./styles/themes";
import { GlobalStyles } from "./styles/GlobalStyles";
import { MyRoutes } from "./routers/routes";
import { useThemeStore } from "./store/ThemeStore";
import { useUsuariosStore } from "./store/UsuariosStore";

const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-query-devtools").then((module) => ({
        default: module.ReactQueryDevtools,
      })),
    )
  : null;

function App() {
  const { setTheme, themeStyle } = useThemeStore();
  const { datausuarios } = useUsuariosStore();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === "/login") {
      setTheme({
        tema: "light",
        style: Light,
      });
    } else {
      if (datausuarios) {
        const themeStyle = datausuarios?.tema === "light" ? Light : Dark;
        setTheme({
          tema: datausuarios?.tema,
          style: themeStyle,
        });
      }
    }
  }, [datausuarios, location.pathname, setTheme]);
  return (
    <ThemeProvider theme={themeStyle}>
      <AuthContextProvider>
        <GlobalStyles />

        <MyRoutes />

        {ReactQueryDevtools && (
          <Suspense fallback={null}>
            <ReactQueryDevtools initialIsOpen={false} />
          </Suspense>
        )}
      </AuthContextProvider>
    </ThemeProvider>
  );
}

export default App;

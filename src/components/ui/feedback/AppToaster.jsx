import { Toaster } from "sonner";
import { useTheme } from "styled-components";

export function AppToaster({ position = "top-right" }) {
  const theme = useTheme();
  const dark = theme.body === "#000";

  return (
    <Toaster
      position={position}
      theme={dark ? "dark" : "light"}
      richColors
      closeButton
      expand
      visibleToasts={4}
      toastOptions={{
        duration: 4200,
        style: {
          borderRadius: "14px",
          border: `1px solid ${theme.color2}`,
          background: theme.bgcards,
          color: theme.text,
          boxShadow: "0 18px 48px rgba(7, 14, 28, 0.18)",
          padding: "14px 16px",
        },
      }}
    />
  );
}

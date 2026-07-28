import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FiAlertTriangle, FiInfo, FiX } from "react-icons/fi";
import styled from "styled-components";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Volver",
  tone = "danger",
  pending = false,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => cancelRef.current?.focus(), 40);

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !pending) onCancel?.();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onCancel, pending]);

  if (!open) return null;

  return createPortal(
    <Backdrop
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onCancel?.();
      }}
    >
      <Dialog
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        $tone={tone}
      >
        <header>
          <span className="dialog-icon" aria-hidden="true">
            {tone === "danger" ? <FiAlertTriangle /> : <FiInfo />}
          </span>
          <button
            type="button"
            className="icon-close"
            onClick={onCancel}
            disabled={pending}
            aria-label="Cerrar confirmación"
          >
            <FiX />
          </button>
        </header>

        <div className="dialog-copy">
          <span className="dialog-kicker">
            {tone === "danger" ? "Acción importante" : "Confirmación"}
          </span>
          <h2 id="confirm-dialog-title">{title}</h2>
          <p id="confirm-dialog-description">{description}</p>
        </div>

        <footer>
          <button
            ref={cancelRef}
            type="button"
            className="secondary"
            onClick={onCancel}
            disabled={pending}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="primary"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "Procesando…" : confirmLabel}
          </button>
        </footer>
      </Dialog>
    </Backdrop>,
    document.body
  );
}

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(7, 14, 28, 0.62);
  backdrop-filter: blur(7px);
  animation: dialog-backdrop-in 160ms ease-out;

  @keyframes dialog-backdrop-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const Dialog = styled.section`
  width: min(440px, 100%);
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.color2};
  border-radius: 22px;
  background: ${({ theme }) => theme.bgcards};
  color: ${({ theme }) => theme.text};
  box-shadow: 0 24px 80px rgba(7, 14, 28, 0.28);
  animation: dialog-card-in 180ms cubic-bezier(0.2, 0.8, 0.2, 1);

  @keyframes dialog-card-in {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  > header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 22px 22px 0;
  }

  .dialog-icon {
    width: 46px;
    height: 46px;
    display: grid;
    place-items: center;
    border-radius: 14px;
    background: ${({ $tone }) =>
      $tone === "danger" ? "rgba(220, 38, 38, 0.1)" : "rgba(37, 99, 235, 0.1)"};
    color: ${({ $tone }) => ($tone === "danger" ? "#dc2626" : "#2563eb")};
    font-size: 21px;
  }

  .icon-close {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 10px;
    background: ${({ theme }) => theme.bgtotal};
    color: ${({ theme }) => theme.colorSubtitle};
    cursor: pointer;

    &:hover {
      color: ${({ theme }) => theme.text};
    }
  }

  .dialog-copy {
    padding: 18px 22px 22px;
  }

  .dialog-kicker {
    color: ${({ $tone }) => ($tone === "danger" ? "#dc2626" : "#2563eb")};
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  h2 {
    margin: 7px 0 8px;
    font-size: clamp(20px, 4vw, 25px);
    line-height: 1.18;
  }

  p {
    margin: 0;
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 14px;
    line-height: 1.6;
  }

  > footer {
    display: flex;
    justify-content: flex-end;
    gap: 9px;
    border-top: 1px solid ${({ theme }) => theme.color2};
    background: ${({ theme }) => theme.bgtotal};
    padding: 15px 22px;
  }

  footer button {
    min-height: 42px;
    border-radius: 11px;
    padding: 0 17px;
    font: inherit;
    font-size: 13px;
    font-weight: 850;
    cursor: pointer;
  }

  .secondary {
    border: 1px solid ${({ theme }) => theme.color2};
    background: ${({ theme }) => theme.bgcards};
    color: ${({ theme }) => theme.text};
  }

  .primary {
    border: 1px solid transparent;
    background: ${({ $tone }) => ($tone === "danger" ? "#dc2626" : "#2563eb")};
    color: #fff;
    box-shadow: 0 8px 22px
      ${({ $tone }) =>
        $tone === "danger" ? "rgba(220, 38, 38, 0.22)" : "rgba(37, 99, 235, 0.22)"};
  }

  button:disabled {
    cursor: wait;
    opacity: 0.58;
  }

  @media (max-width: 480px) {
    border-radius: 18px;

    > footer {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }

    footer button {
      padding: 0 10px;
    }
  }
`;

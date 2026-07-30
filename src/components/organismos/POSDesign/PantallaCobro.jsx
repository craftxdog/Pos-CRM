import { Icon } from "@iconify/react/dist/iconify.js";
import { useEffect, useRef } from "react";
import styled from "styled-components";

import { IngresoCobro } from "./IngresoCobro";
import { useVentasStore } from "../../../store/VentasStore";
import { useDetalleVentasStore } from "../../../store/DetalleVentasStore";
import { Switch } from "../../ui/toggles/Switch";
import { useImpresorasStore } from "../../../store/ImpresorasStore";
import { useEditarImpresorasMutation } from "../../../tanstack/ImpresorasStack";
export function PantallaCobro() {
  const { setStatePantallaCobro, tipocobro } = useVentasStore();
  const ingresoCobroRef = useRef();
  const { datadetalleventa } = useDetalleVentasStore();
  const { statePrintDirecto, setStatePrintDirecto } = useImpresorasStore();
  const { mutate, isPending } = useEditarImpresorasMutation();
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Enter") {
        event.preventDefault(); // Evita el comportamiento predeterminado de presionar Enter (como cerrar la vista)
        if (ingresoCobroRef.current) {
          ingresoCobroRef.current.mutateAsync();
        }
      }
    };
    // Añade el event listener al document
    document.addEventListener("keydown", handleKeyDown);
    // Limpia el event listener al desmontar el componente
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
  const volverAlPos = () =>
    setStatePantallaCobro({
      data: datadetalleventa,
      tipocobro,
    });

  const togglePrintDirecto = () => {
    const nextState = !statePrintDirecto;
    setStatePrintDirecto(nextState);
    mutate(nextState);
  };

  return (
    <Container>
      <section className="contentingresocobro">
        <Toolbar>
          <ActionButton type="button" onClick={volverAlPos}>
            <Icon icon="ep:arrow-left-bold" />
            <span>Volver al POS</span>
          </ActionButton>

          <div className="heading">
            <span>Finalizar venta</span>
            <small>Revisa el comprobante y confirma el pago</small>
          </div>

          <ContentSwich>
            <div>
              <span>Impresión directa</span>
              <small>
                {statePrintDirecto ? "Activada" : "Usar diálogo de impresión"}
              </small>
            </div>
            <Switch
              state={statePrintDirecto}
              setState={togglePrintDirecto}
            />
          </ContentSwich>
        </Toolbar>

        {isPending ? (
          <StatusMessage>
            <Icon icon="line-md:loading-twotone-loop" />
            Guardando preferencia de impresión…
          </StatusMessage>
        ) : null}

        <IngresoCobro ref={ingresoCobroRef} />
      </section>
    </Container>
  );
}
const Container = styled.div`
  position: fixed;
  inset: 0;
  height: 100vh;
  height: 100dvh;
  width: 100vw;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  z-index: 100;
  background-color: ${({ theme }) => theme.bgtotal};
  padding: clamp(18px, 4vw, 52px) 18px 24px;
  overflow-y: auto;
  .contentingresocobro {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    gap: 18px;
    width: 100%;
    max-width: 980px;
    min-height: min-content;
    height: auto;
  }
`;
const Toolbar = styled.header`
  width: 100%;
  min-height: 86px;
  padding: 14px;
  display: grid;
  grid-template-columns: minmax(170px, 1fr) minmax(220px, 1.4fr) minmax(230px, 1fr);
  align-items: center;
  gap: 16px;
  border: 1px solid ${({ theme }) => theme.color2};
  border-radius: 20px;
  background: ${({ theme }) => theme.body};
  color: ${({ theme }) => theme.text};
  box-shadow: ${({ theme }) => theme.boxshadow};

  .heading {
    display: flex;
    flex-direction: column;
    text-align: center;

    span {
      font-size: clamp(20px, 2.5vw, 28px);
      font-weight: 800;
      line-height: 1.15;
    }

    small {
      margin-top: 4px;
      color: ${({ theme }) => theme.colorSubtitle};
    }
  }

  @media (max-width: 760px) {
    grid-template-columns: 1fr auto;

    .heading {
      grid-column: 1 / -1;
      grid-row: 1;
    }
  }

  @media (max-width: 520px) {
    grid-template-columns: 1fr;

    .heading,
    > button,
    > section {
      grid-column: 1;
    }
  }
`;

const ActionButton = styled.button`
  min-height: 48px;
  padding: 10px 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  border: 1px solid ${({ theme }) => theme.color2};
  border-radius: 13px;
  background: ${({ theme }) => theme.bg2};
  color: ${({ theme }) => theme.text};
  font-weight: 750;
  cursor: pointer;

  svg {
    width: 22px;
    height: 22px;
  }
`;

const ContentSwich = styled.section`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 15px;

  > div {
    display: flex;
    flex-direction: column;
    text-align: right;

    span {
      font-weight: 750;
    }

    small {
      color: ${({ theme }) => theme.colorSubtitle};
    }
  }

  @media (max-width: 520px) {
    justify-content: center;
  }
`;

const StatusMessage = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: ${({ theme }) => theme.colorSubtitle};
  font-size: 14px;

  svg {
    width: 20px;
    height: 20px;
  }
`;

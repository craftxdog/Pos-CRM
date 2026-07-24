import { v } from "../../../styles/variables";
import styled from "styled-components";
import { useState } from "react";

import { BtnClose } from "../../ui/buttons/BtnClose";
import { useGlobalStore } from "../../../store/GlobalStore";
import { useAsignacionCajaSucursalStore } from "../../../store/AsignacionCajaSucursalStore";
import { useEditarSerializacionMutation } from "../../../tanstack/SerializacionStack";

function clampNumber(value, fallback, min = 0) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(min, parsed);
}

export const RegistrarSerializacion = () => {
  const { setStateClose, itemSelect } = useGlobalStore();
  const [cantidadNumeros, setCantidadNumeros] = useState(itemSelect?.cantidad_numeros || 8);
  const { sucursalesItemSelectAsignadas } = useAsignacionCajaSucursalStore();
  const { mutate, isPending } = useEditarSerializacionMutation();
  const [correlativo, setCorrelativo] = useState(itemSelect?.correlativo || 1);
  const [serie, setSerie] = useState(itemSelect?.serie || "A001");

  const formatearCorrelativo = (numero, longitud) => {
    return String(numero).padStart(longitud, "0");
  };

  const guardar = (event) => {
    event.preventDefault();
    mutate({
      cantidad_numeros: Number(cantidadNumeros),
      correlativo: Number(correlativo),
      serie: serie.trim().toUpperCase(),
      sucursal_id: sucursalesItemSelectAsignadas?.id_sucursal,
    });
  };

  return (
    <Container>
      <section className="sub-container">
        <BtnClose color={"#000"} funcion={() => setStateClose(false)} />
        <div className="comprobante">
          <span className="title">Comprobante</span>
          <div className="tipo"> {itemSelect?.tipo_comprobantes?.nombre} </div>
          <div className="numero">
            <span>{serie.trim().toUpperCase()}-</span>
            <span>{formatearCorrelativo(correlativo, cantidadNumeros)}</span>
          </div>
        </div>

        <form className="form" onSubmit={guardar}>
          <label>
            <span>Cantidad de numeros</span>
            <div className="input-shell">
              <v.iconoflechaderecha />
              <input
                aria-label="Cantidad de numeros"
                type="number"
                min="1"
                max="12"
                value={cantidadNumeros}
                onChange={(e) =>
                  setCantidadNumeros(clampNumber(e.target.value, 1, 1))
                }
                required
              />
            </div>
          </label>

          <label>
            <span>Correlativo actual</span>
            <div className="input-shell">
              <v.iconoflechaderecha />
              <input
                aria-label="Correlativo"
                type="number"
                min="0"
                value={correlativo}
                onChange={(e) =>
                  setCorrelativo(clampNumber(e.target.value, 0, 0))
                }
                required
              />
            </div>
          </label>

          <label>
            <span>Serie</span>
            <div className="input-shell">
              <v.iconoflechaderecha />
              <input
                aria-label="Serie"
                type="text"
                value={serie}
                onChange={(e) => setSerie(e.target.value.toUpperCase())}
                maxLength="12"
                required
              />
            </div>
          </label>

          <div className="buttons">
            <button type="button" className="secondary" onClick={() => setStateClose(false)}>
              Cancelar
            </button>
            <button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </section>
    </Container>
  );
};

/* Styled Components Anidado */
const Container = styled.div`
  transition: 0.5s;
  top: 0;
  left: 0;
  position: fixed;
  display: flex;
  width: 100%;
  min-height: 100vh;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 18px;
  background: rgba(15, 23, 42, 0.35);
  input {
    color: ${({ theme }) => theme.text};
  }
  .sub-container {
    width: min(440px, 100%);
    display: grid;
    position: relative;
    background: ${({ theme }) => theme.bgtotal};
    padding: 22px;
    border-radius: 8px;
    box-shadow: 0 24px 70px rgba(15, 23, 42, 0.22);
    gap: 18px;

    .form {
      display: grid;
      gap: 12px;
    }
  }
  .comprobante {
    display: grid;
    gap: 8px;
    justify-items: center;
    background: #fff;
    padding: 18px;
    border-radius: 8px;
    text-align: center;
    position: relative;
    .title {
      color: #000;
      font-weight: bold;
      text-transform: uppercase;
    }
    .tipo {
      background: #ea5605;
      color: #111;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: bold;
      text-transform: uppercase;
    }

    .numero {
      margin-top: 10px;
      font-size: 18px;
      font-weight: bold;
      background: white;
      padding: 5px 10px;
      border-radius: 4px;
      border: 2px solid black;

      span:first-child {
        color: red;
      }
      span:last-child {
        color: black;
      }
    }
  }

  .checkbox {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  label {
    display: grid;
    gap: 6px;
    color: ${({ theme }) => theme.text};
    font-weight: 700;

    span {
      font-size: 13px;
      color: ${({ theme }) => theme.colorSubtitle};
    }
  }

  .input-shell {
    min-height: 46px;
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 8px;
    background: ${({ theme }) => theme.bgcards};
    padding: 0 12px;

    svg {
      flex: 0 0 auto;
      color: ${({ theme }) => theme.colorSubtitle};
    }

    input {
      width: 100%;
      min-width: 0;
      border: 0;
      outline: 0;
      background: transparent;
      font: inherit;
      font-weight: 700;
    }
  }

  .buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;

    button {
      min-height: 44px;
      border: 0;
      border-radius: 8px;
      cursor: pointer;
      color: black;
      font-weight: bold;
      background: ${v.colorPrincipal};
    }

    button:disabled {
      opacity: 0.7;
      cursor: wait;
    }

    .secondary {
      background: ${({ theme }) => theme.bgcards};
      color: ${({ theme }) => theme.text};
      border: 1px solid ${({ theme }) => theme.color2};
    }
  }
`;

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  FiCheck,
  FiChevronDown,
  FiSearch,
  FiUser,
  FiX,
} from "react-icons/fi";
import styled from "styled-components";

const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");

const clientName = (client) =>
  [client?.nombres, client?.apellidos].filter(Boolean).join(" ").trim() ||
  "Cliente";

export function ClientSearchPicker({
  clients = [],
  name = "id_cliente_crm",
  required = false,
}) {
  const id = useId();
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);

  const activeClients = useMemo(
    () => clients.filter((client) => client.estado !== "inactivo"),
    [clients],
  );
  const matches = useMemo(() => {
    const term = normalize(query);
    const source = term
      ? activeClients.filter((client) =>
          normalize(
            [
              clientName(client),
              client.codigo,
              client.email,
              client.telefono,
              client.identificador_nacional,
            ].join(" "),
          ).includes(term),
        )
      : activeClients;
    return source.slice(0, 7);
  }, [activeClients, query]);

  useEffect(() => {
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return undefined;
    const reset = () => {
      setQuery("");
      setSelected(null);
      setOpen(false);
      inputRef.current?.setCustomValidity("");
    };
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, []);

  const selectClient = (client) => {
    setSelected(client);
    setQuery(clientName(client));
    setOpen(false);
    inputRef.current?.setCustomValidity("");
  };

  return (
    <Container ref={rootRef}>
      <input name={name} type="hidden" value={selected?.id || ""} readOnly />
      <div className={`control ${open ? "open" : ""}`}>
        <FiSearch aria-hidden="true" />
        <input
          ref={inputRef}
          id={id}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          autoComplete="off"
          placeholder="Buscar cliente, teléfono o correo"
          value={query}
          required={required}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(null);
            setOpen(true);
            event.target.setCustomValidity(
              event.target.value
                ? "Selecciona un cliente de la lista."
                : "",
            );
          }}
          onInvalid={(event) => {
            if (required && !selected) {
              event.currentTarget.setCustomValidity(
                "Busca y selecciona un cliente de la lista.",
              );
            }
          }}
        />
        {selected ? (
          <button
            type="button"
            aria-label="Quitar cliente seleccionado"
            onClick={() => {
              setSelected(null);
              setQuery("");
              setOpen(true);
              inputRef.current?.setCustomValidity("");
            }}
          >
            <FiX />
          </button>
        ) : (
          <FiChevronDown aria-hidden="true" />
        )}
      </div>
      {open ? (
        <div className="options" id={`${id}-options`} role="listbox">
          <header>
            <span>{query ? "Coincidencias" : "Clientes recientes"}</span>
            <small>{matches.length} visibles</small>
          </header>
          {matches.map((client) => (
            <button
              className="option"
              type="button"
              role="option"
              aria-selected={String(client.id) === String(selected?.id)}
              key={client.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectClient(client)}
            >
              <span className="avatar" aria-hidden="true">
                <FiUser />
              </span>
              <span className="option-copy">
                <b>{clientName(client)}</b>
                <small>
                  {[client.telefono, client.email].filter(Boolean).join(" · ") ||
                    "Sin datos de contacto"}
                </small>
              </span>
              <span className="option-meta">
                {client.codigo ? <em>{client.codigo}</em> : null}
                {String(client.id) === String(selected?.id) ? <FiCheck /> : null}
              </span>
            </button>
          ))}
          {!matches.length ? (
            <p>No encontramos clientes con esa búsqueda.</p>
          ) : null}
        </div>
      ) : null}
    </Container>
  );
}

const Container = styled.div`
  position: relative;
  min-width: 0;
  .control {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    box-sizing: border-box;
    padding: 0 11px;
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 10px;
    background: ${({ theme }) => theme.bgtotal};
  }
  .control.open {
    border-color: #0ea5e9;
    box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.14);
  }
  .control input {
    min-width: 0;
    flex: 1;
    padding: 11px 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: ${({ theme }) => theme.text};
  }
  .control button {
    min-width: auto !important;
    min-height: auto !important;
    padding: 4px !important;
    border: 0 !important;
    background: transparent !important;
    color: ${({ theme }) => theme.text};
    box-shadow: none !important;
  }
  .options {
    position: absolute;
    top: calc(100% + 7px);
    left: 0;
    right: 0;
    z-index: 120;
    max-height: min(390px, 52vh);
    overflow-x: hidden;
    overflow-y: auto;
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 13px;
    background: ${({ theme }) => theme.bgcards};
    box-shadow: 0 16px 35px rgba(15, 23, 42, 0.2);
  }
  .options header {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 9px 12px;
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 11px;
    background: ${({ theme }) => theme.bgcards};
    border-bottom: 1px solid ${({ theme }) => theme.color2};
  }
  .options > .option {
    width: 100%;
    min-width: 0 !important;
    min-height: 62px !important;
    display: grid !important;
    grid-template-columns: 38px minmax(0, 1fr) auto;
    justify-content: stretch !important;
    align-items: center !important;
    gap: 10px;
    padding: 9px 12px !important;
    text-align: left !important;
    border: 0 !important;
    border-bottom: 1px solid ${({ theme }) => theme.color2} !important;
    border-radius: 0 !important;
    background: ${({ theme }) => theme.bgcards} !important;
    color: ${({ theme }) => theme.text} !important;
    box-shadow: none !important;
  }
  .options > .option:hover,
  .options > .option:focus-visible {
    background: ${({ theme }) => theme.bgAlpha} !important;
    outline: 2px solid rgba(14, 165, 233, 0.55);
    outline-offset: -2px;
  }
  .avatar {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    color: #0284c7;
    background: rgba(14, 165, 233, 0.12);
  }
  .option-copy {
    min-width: 0;
  }
  .option-copy b,
  .option-copy small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .option-meta {
    display: grid;
    justify-items: end;
    gap: 4px;
    color: #0284c7;
  }
  .option-meta em {
    padding: 3px 7px;
    border-radius: 999px;
    background: rgba(14, 165, 233, 0.1);
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 10px;
    font-style: normal;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  .options b,
  .options small {
    display: block;
  }
  .options small {
    margin-top: 2px;
    color: ${({ theme }) => theme.colorSubtitle};
  }
  .options p {
    margin: 0;
    padding: 14px 12px;
    color: ${({ theme }) => theme.colorSubtitle};
  }
`;

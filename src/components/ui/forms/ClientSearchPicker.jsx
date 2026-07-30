import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FiCheck, FiChevronDown, FiSearch, FiX } from "react-icons/fi";
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
              client.email,
              client.telefono,
              client.identificador_nacional,
            ].join(" "),
          ).includes(term),
        )
      : activeClients;
    return source.slice(0, 8);
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
              type="button"
              role="option"
              aria-selected={String(client.id) === String(selected?.id)}
              key={client.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectClient(client)}
            >
              <span>
                <b>{clientName(client)}</b>
                <small>
                  {[client.telefono, client.email].filter(Boolean).join(" · ") ||
                    "Sin datos de contacto"}
                </small>
              </span>
              {String(client.id) === String(selected?.id) ? <FiCheck /> : null}
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
    padding: 3px;
    border: 0;
    background: transparent;
    color: ${({ theme }) => theme.text};
  }
  .options {
    position: absolute;
    top: calc(100% + 7px);
    left: 0;
    right: 0;
    z-index: 120;
    overflow: hidden;
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 13px;
    background: ${({ theme }) => theme.bgcards};
    box-shadow: 0 16px 35px rgba(15, 23, 42, 0.2);
  }
  .options header {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 9px 12px;
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 11px;
  }
  .options > button {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    text-align: left;
    border: 0;
    border-top: 1px solid ${({ theme }) => theme.color2};
    border-radius: 0;
    background: transparent;
    color: ${({ theme }) => theme.text};
  }
  .options > button:hover {
    background: ${({ theme }) => theme.bgAlpha};
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

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiEdit3,
  FiLogOut,
  FiSearch,
  FiToggleLeft,
  FiToggleRight,
  FiTrash2,
  FiUser,
  FiUserX,
} from "react-icons/fi";
import styled from "styled-components";
import { toast } from "sonner";

function fullName(item) {
  return [item?.nombres, item?.apellidos].filter(Boolean).join(" ");
}

function timeOnly(value) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const attendanceCopy = {
  presente: "Presente",
  tarde: "Llegó tarde",
  ausente: "Ausente",
  salida_registrada: "Salida registrada",
};

function ScheduleDirectory({ crm, dataempresa }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todos");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  useEffect(() => setPage(1), [search, status]);
  const schedulesQuery = useQuery({
    queryKey: ["crm-schedules-directory", dataempresa?.id, page, search, status],
    queryFn: () => crm.mostrarHorariosPage({ id_empresa: dataempresa.id, page, pageSize: 5, search, status }),
    enabled: Boolean(dataempresa?.id),
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: false,
  });
  const result = schedulesQuery.data || { data: [], pagination: { page: 1, totalPages: 1, total: 0, from: 0, to: 0, hasPreviousPage: false, hasNextPage: false } };
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["crm-schedules-directory"] }),
      queryClient.invalidateQueries({ queryKey: ["crm-data"] }),
      queryClient.invalidateQueries({ queryKey: ["crm-attendance-clients"] }),
    ]);
  };
  const saveMutation = useMutation({
    mutationFn: (values) => editing
      ? crm.editarHorario({ id: editing.id, id_empresa: dataempresa.id, ...values })
      : crm.insertarHorario({ id_empresa: dataempresa.id, ...values, activo: true }),
    onSuccess: async () => { toast.success(editing ? "Horario actualizado" : "Horario creado"); setEditing(null); await refresh(); },
    onError: (error) => toast.error(error.message),
  });
  const changeMutation = useMutation({
    mutationFn: ({ action, item }) => action === "delete"
      ? crm.eliminarHorario({ id: item.id, id_empresa: dataempresa.id })
      : crm.editarHorario({ id: item.id, id_empresa: dataempresa.id, activo: !item.activo }),
    onSuccess: async (_, variables) => { toast.success(variables.action === "delete" ? "Horario eliminado" : "Estado del horario actualizado"); await refresh(); },
    onError: (error) => toast.error(error.message),
  });
  const submit = (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    saveMutation.mutate({
      nombre: values.nombre.trim(),
      hora_entrada: values.hora_entrada,
      hora_salida: values.hora_salida,
      tolerancia_minutos: Number(values.tolerancia_minutos || 0),
    });
  };
  return <section className="schedule-directory">
    <header><div><h3>Directorio de horarios</h3><p>Administra los turnos disponibles. Se muestran cinco resultados por página.</p></div><span>{result.pagination.total}</span></header>
    <div className="schedule-filters"><label><FiSearch /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar horario" /></label><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="todos">Todos los estados</option><option value="activo">Activos</option><option value="inactivo">Inactivos</option></select></div>
    <div className="schedule-table"><div className="schedule-directory-row head"><span>Horario</span><span>Jornada</span><span>Tolerancia</span><span>Estado</span><span>Acciones</span></div>{result.data.map((item) => <div className="schedule-directory-row" key={item.id}><strong>{item.nombre}</strong><span>{item.hora_entrada?.slice(0, 5)} – {item.hora_salida?.slice(0, 5)}</span><span>{item.tolerancia_minutos} min</span><span className={item.activo ? "tag active" : "tag inactive"}>{item.activo ? "Activo" : "Inactivo"}</span><div className="schedule-actions"><button type="button" className="mini" onClick={() => setEditing(item)}><FiEdit3 /> Editar</button><button type="button" className="mini" onClick={() => changeMutation.mutate({ action: "toggle", item })} disabled={changeMutation.isPending}>{item.activo ? <FiToggleRight /> : <FiToggleLeft />}{item.activo ? "Desactivar" : "Activar"}</button><button type="button" className="mini danger" onClick={() => { if (window.confirm(`¿Eliminar el horario ${item.nombre}?`)) changeMutation.mutate({ action: "delete", item }); }} disabled={changeMutation.isPending}><FiTrash2 /> Eliminar</button></div></div>)}{!result.data.length ? <p className="empty-schedules">No hay horarios para estos filtros.</p> : null}</div>
    <footer className="schedule-pagination"><span>Mostrando {result.pagination.from}–{result.pagination.to} de {result.pagination.total}</span><div><button type="button" disabled={!result.pagination.hasPreviousPage} onClick={() => setPage((value) => value - 1)}><FiChevronLeft /></button><b>{result.pagination.page} / {result.pagination.totalPages}</b><button type="button" disabled={!result.pagination.hasNextPage} onClick={() => setPage((value) => value + 1)}><FiChevronRight /></button></div></footer>
    <form className="schedule-form" onSubmit={submit} key={editing?.id || "new"}><h4>{editing ? `Editar: ${editing.nombre}` : "Crear horario"}</h4><input name="nombre" placeholder="Nombre del horario" required defaultValue={editing?.nombre || ""} /><div><input name="hora_entrada" type="time" required defaultValue={editing?.hora_entrada?.slice(0, 5) || ""} /><input name="hora_salida" type="time" required defaultValue={editing?.hora_salida?.slice(0, 5) || ""} /></div><input name="tolerancia_minutos" type="number" min="0" defaultValue={editing?.tolerancia_minutos ?? 10} /><div className="form-actions">{editing ? <button type="button" className="secondary" onClick={() => setEditing(null)}>Cancelar</button> : null}<button disabled={saveMutation.isPending}>{saveMutation.isPending ? "Guardando…" : editing ? "Actualizar horario" : "Crear horario"}</button></div></form>
  </section>;
}

export function CrmAttendanceWorkspace({
  crm,
  dataempresa,
  mutation,
  submitForm,
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [scheduleId, setScheduleId] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      250
    );
    return () => window.clearTimeout(timer);
  }, [search]);

  const clientsQuery = useQuery({
    queryKey: ["crm-attendance-clients", dataempresa?.id, debouncedSearch],
    queryFn: () =>
      crm.mostrarClientesAsistencia({
        id_empresa: dataempresa.id,
        search: debouncedSearch,
        limit: 10,
      }),
    enabled: !!dataempresa?.id && debouncedSearch.length > 0,
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: false,
  });

  const selected = useMemo(
    () => clientsQuery.data?.find((item) => item.id === selectedId) || null,
    [clientsQuery.data, selectedId]
  );

  useEffect(() => {
    if (selected) {
      setScheduleId(selected.id_horario ? String(selected.id_horario) : "");
    }
  }, [selected]);

  const refreshWorkspace = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["crm-attendance-clients"] }),
      queryClient.invalidateQueries({ queryKey: ["crm-data"] }),
    ]);
  };

  const scheduleMutation = useMutation({
    mutationFn: () =>
      crm.asignarHorarioCliente({
        id_cliente_crm: selected.id,
        id_horario: scheduleId || null,
      }),
    onSuccess: async () => {
      toast.success("Horario del cliente actualizado");
      await refreshWorkspace();
    },
    onError: (error) => toast.error(error.message),
  });

  const attendanceMutation = useMutation({
    mutationFn: (estado) =>
      crm.registrarAsistencia({
        id_cliente_crm: selected.id,
        id_horario: scheduleId || null,
        estado,
        notas: notes,
      }),
    onSuccess: async (_, estado) => {
      toast.success(`Asistencia marcada: ${attendanceCopy[estado]}`);
      setNotes("");
      await refreshWorkspace();
    },
    onError: (error) => toast.error(error.message),
  });

  const selectClient = (item) => {
    setSelectedId(item.id);
    setSearch(item.codigo || item.cliente_nombre);
  };

  const loadFromSearch = () => {
    const results = clientsQuery.data || [];
    const normalized = search.trim().toLowerCase();
    const exact =
      results.find(
        (item) => String(item.codigo || "").toLowerCase() === normalized
      ) || results[0];
    if (exact) selectClient(exact);
  };

  return (
    <Container>
      <section className="attendance-hero">
        <div>
          <span className="eyebrow">
            <FiClock /> Terminal de asistencia
          </span>
          <h2>Busca por código o nombre y registra en un toque</h2>
          <p>
            Al cargar un cliente verás su horario, plan y asistencia de hoy.
            Puedes corregir Presente ↔ Ausente sin crear registros duplicados.
          </p>
        </div>
        <div className="today">
          <strong>{new Date().toLocaleDateString("es", { day: "2-digit" })}</strong>
          <span>
            {new Date().toLocaleDateString("es", {
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
      </section>

      <section className="attendance-layout">
        <div className="terminal-card">
          <header>
            <div>
              <h3>Cargar cliente</h3>
              <p>Escribe el código completo o busca por datos de contacto.</p>
            </div>
          </header>

          <label className="searchbox">
            <FiSearch />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSelectedId(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  loadFromSearch();
                }
              }}
              placeholder="Ej. CLI-000123, nombre, correo o teléfono"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={loadFromSearch}
              disabled={!clientsQuery.data?.length}
            >
              Cargar
            </button>
          </label>

          {!selected && debouncedSearch ? (
            <div className="results">
              {clientsQuery.isFetching ? (
                <p>Buscando cliente...</p>
              ) : (
                clientsQuery.data?.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => selectClient(item)}
                  >
                    <span className="avatar">
                      <FiUser />
                    </span>
                    <span>
                      <strong>{item.cliente_nombre}</strong>
                      <small>
                        {item.codigo} · {item.email || item.telefono || "Sin contacto"}
                      </small>
                    </span>
                    <b>{item.plan_nombre || "Sin plan"}</b>
                  </button>
                ))
              )}
              {!clientsQuery.isFetching && !clientsQuery.data?.length ? (
                <p>No encontramos clientes con esa búsqueda.</p>
              ) : null}
            </div>
          ) : null}

          {selected ? (
            <article className="client-card">
              <header>
                <span className="avatar large">
                  <FiUser />
                </span>
                <div>
                  <span className="code">{selected.codigo}</span>
                  <h3>{selected.cliente_nombre}</h3>
                  <p>{selected.email || selected.telefono || "Sin contacto"}</p>
                </div>
                <span
                  className={`attendance-status ${
                    selected.asistencia_estado || "sin_registro"
                  }`}
                >
                  {attendanceCopy[selected.asistencia_estado] || "Sin registro hoy"}
                </span>
              </header>

              <div className="client-facts">
                <span>
                  <small>Plan</small>
                  <strong>{selected.plan_nombre || "Sin suscripción"}</strong>
                  <b>{selected.suscripcion_fecha_fin || "—"}</b>
                </span>
                <span>
                  <small>Horario</small>
                  <strong>{selected.horario_nombre || "Sin asignar"}</strong>
                  <b>
                    {selected.horario_entrada
                      ? `${selected.horario_entrada.slice(0, 5)} – ${selected.horario_salida.slice(0, 5)}`
                      : "—"}
                  </b>
                </span>
                <span>
                  <small>Entrada / salida</small>
                  <strong>{timeOnly(selected.asistencia_hora_entrada)}</strong>
                  <b>{timeOnly(selected.asistencia_hora_salida)}</b>
                </span>
              </div>

              <div className="schedule-row">
                <select
                  value={scheduleId}
                  onChange={(event) => setScheduleId(event.target.value)}
                >
                  <option value="">Sin horario asignado</option>
                  {crm.horarios
                    .filter((item) => item.activo)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nombre} · {item.hora_entrada.slice(0, 5)}–
                        {item.hora_salida.slice(0, 5)}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={() => scheduleMutation.mutate()}
                  disabled={scheduleMutation.isPending}
                >
                  Guardar horario
                </button>
              </div>

              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Nota opcional de la asistencia"
              />

              <div className="attendance-actions">
                <button
                  type="button"
                  className="present"
                  onClick={() => attendanceMutation.mutate("presente")}
                  disabled={attendanceMutation.isPending}
                >
                  <FiCheck /> Presente
                </button>
                <button
                  type="button"
                  className="late"
                  onClick={() => attendanceMutation.mutate("tarde")}
                  disabled={attendanceMutation.isPending}
                >
                  <FiClock /> Tarde
                </button>
                <button
                  type="button"
                  className="absent"
                  onClick={() => attendanceMutation.mutate("ausente")}
                  disabled={attendanceMutation.isPending}
                >
                  <FiUserX /> Ausente
                </button>
                <button
                  type="button"
                  className="exit"
                  onClick={() => attendanceMutation.mutate("salida_registrada")}
                  disabled={attendanceMutation.isPending}
                >
                  <FiLogOut /> Salida
                </button>
              </div>
            </article>
          ) : null}
        </div>

        <aside className="schedule-card">
          <header>
            <h3>Horarios disponibles</h3>
            <span>{crm.horarios.length}</span>
          </header>
          <div className="schedule-list">
            {crm.horarios.map((item) => (
              <article key={item.id}>
                <strong>{item.nombre}</strong>
                <span>
                  {item.hora_entrada.slice(0, 5)} – {item.hora_salida.slice(0, 5)}
                </span>
                <small>{item.tolerancia_minutos} min de tolerancia</small>
              </article>
            ))}
          </div>
          <form onSubmit={submitForm("horario")}>
            <h4>Crear horario</h4>
            <input name="nombre" placeholder="Nombre del horario" required />
            <div>
              <input name="hora_entrada" type="time" required />
              <input name="hora_salida" type="time" required />
            </div>
            <input
              name="tolerancia_minutos"
              type="number"
              min="0"
              defaultValue="10"
            />
            <button disabled={mutation.isPending}>Crear horario</button>
          </form>
        </aside>
      </section>
      <ScheduleDirectory crm={crm} dataempresa={dataempresa} />
    </Container>
  );
}

const Container = styled.section`
  width: min(1380px, 100%);
  margin: 0 auto;
  display: grid;
  gap: 16px;

  .attendance-hero,
  .terminal-card,
  .schedule-card {
    border: 1px solid ${({ theme }) => theme.color2};
    background: ${({ theme }) => theme.bgcards};
    color: ${({ theme }) => theme.text};
  }

  .attendance-hero {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    align-items: end;
    border-radius: 18px;
    padding: 22px;
    background:
      linear-gradient(120deg, rgba(56, 189, 248, 0.13), transparent 48%),
      ${({ theme }) => theme.bgcards};

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      color: #0284c7;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h2 {
      margin: 8px 0 6px;
      font-size: clamp(22px, 3vw, 32px);
    }

    p {
      max-width: 720px;
      margin: 0;
      color: ${({ theme }) => theme.colorSubtitle};
      line-height: 1.55;
    }
  }

  .today {
    min-width: 100px;
    display: grid;
    justify-items: center;
    border-radius: 16px;
    background: ${({ theme }) => theme.bgtotal};
    padding: 12px 18px;

    strong {
      font-size: 30px;
    }

    span {
      color: ${({ theme }) => theme.colorSubtitle};
      text-transform: capitalize;
    }
  }

  .attendance-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(260px, 340px);
    gap: 16px;
    align-items: start;
  }

  .terminal-card,
  .schedule-card {
    min-width: 0;
    border-radius: 18px;
    padding: 18px;
  }

  .terminal-card > header,
  .schedule-card > header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;

    h3,
    p {
      margin: 0;
    }

    p {
      margin-top: 3px;
      color: ${({ theme }) => theme.colorSubtitle};
      font-size: 13px;
    }
  }

  .searchbox {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    border: 2px solid #38bdf8;
    border-radius: 14px;
    padding: 7px 7px 7px 14px;

    svg {
      color: #0284c7;
      font-size: 20px;
    }

    input {
      width: 100%;
      border: 0;
      outline: 0;
      background: transparent;
      color: inherit;
      padding: 10px 0;
      font-size: 16px;
    }

    button {
      border: 0;
      border-radius: 10px;
      background: #0f172a;
      color: white;
      padding: 11px 18px;
      font-weight: 800;
      cursor: pointer;
    }
  }

  .results {
    display: grid;
    gap: 7px;
    margin-top: 10px;

    > p {
      margin: 0;
      padding: 16px;
      color: ${({ theme }) => theme.colorSubtitle};
      text-align: center;
    }

    > button {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      width: 100%;
      border: 1px solid ${({ theme }) => theme.color2};
      border-radius: 12px;
      background: ${({ theme }) => theme.bgtotal};
      color: inherit;
      padding: 11px;
      text-align: left;
      cursor: pointer;

      span:not(.avatar) {
        display: grid;
        gap: 2px;
        min-width: 0;
      }

      small {
        color: ${({ theme }) => theme.colorSubtitle};
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      b {
        font-size: 12px;
      }
    }
  }

  .avatar {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border-radius: 11px;
    background: #e0f2fe;
    color: #0369a1;

    &.large {
      width: 52px;
      height: 52px;
      font-size: 22px;
    }
  }

  .client-card {
    margin-top: 16px;
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 16px;
    padding: 16px;

    > header {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;

      h3,
      p {
        margin: 0;
      }

      p {
        color: ${({ theme }) => theme.colorSubtitle};
        font-size: 13px;
      }
    }

    .code {
      color: #0284c7;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.05em;
    }

    textarea {
      width: 100%;
      min-height: 70px;
      margin-top: 12px;
      border: 1px solid ${({ theme }) => theme.color2};
      border-radius: 11px;
      background: ${({ theme }) => theme.bgtotal};
      color: inherit;
      padding: 11px;
      resize: vertical;
    }
  }

  .attendance-status {
    border-radius: 999px;
    background: #e2e8f0;
    color: #475569;
    padding: 7px 10px;
    font-size: 11px;
    font-weight: 900;

    &.presente,
    &.salida_registrada {
      background: #dcfce7;
      color: #166534;
    }

    &.tarde {
      background: #fef3c7;
      color: #92400e;
    }

    &.ausente {
      background: #fee2e2;
      color: #991b1b;
    }
  }

  .client-facts {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin-top: 16px;

    > span {
      display: grid;
      gap: 2px;
      border-radius: 12px;
      background: ${({ theme }) => theme.bgtotal};
      padding: 12px;
    }

    small,
    b {
      color: ${({ theme }) => theme.colorSubtitle};
      font-size: 11px;
    }
  }

  .schedule-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    margin-top: 12px;

    select,
    button {
      border: 1px solid ${({ theme }) => theme.color2};
      border-radius: 10px;
      background: ${({ theme }) => theme.bgtotal};
      color: inherit;
      padding: 11px;
    }

    button {
      font-weight: 800;
      cursor: pointer;
    }
  }

  .attendance-actions {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    margin-top: 12px;

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      border: 0;
      border-radius: 11px;
      padding: 12px 8px;
      font-weight: 900;
      cursor: pointer;
    }

    .present {
      background: #16a34a;
      color: white;
    }

    .late {
      background: #f3d20c;
      color: #111827;
    }

    .absent {
      background: #dc2626;
      color: white;
    }

    .exit {
      background: #0f172a;
      color: white;
    }
  }

  .schedule-card {
    position: sticky;
    top: 92px;

    > header span {
      border-radius: 999px;
      background: #e0f2fe;
      color: #0369a1;
      padding: 5px 9px;
      font-weight: 900;
    }

    form {
      display: grid;
      gap: 8px;
      margin-top: 14px;
      border-top: 1px solid ${({ theme }) => theme.color2};
      padding-top: 14px;

      h4 {
        margin: 0 0 2px;
      }

      > div {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      input,
      button {
        min-width: 0;
        border: 1px solid ${({ theme }) => theme.color2};
        border-radius: 10px;
        background: ${({ theme }) => theme.bgtotal};
        color: inherit;
        padding: 10px;
      }

      button {
        border: 0;
        background: #f3d20c;
        color: #111827;
        font-weight: 900;
        cursor: pointer;
      }
    }
  }

  .schedule-list {
    display: grid;
    gap: 8px;
    max-height: 280px;
    overflow: auto;

    article {
      display: grid;
      gap: 2px;
      border-radius: 11px;
      background: ${({ theme }) => theme.bgtotal};
      padding: 11px;
    }

    span,
    small {
      color: ${({ theme }) => theme.colorSubtitle};
      font-size: 12px;
    }
  }

  .schedule-directory {
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 18px;
    background: ${({ theme }) => theme.bgcards};
    padding: 18px;

    > header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: start;
      margin-bottom: 13px;

      h3, p { margin: 0; }
      p { margin-top: 3px; color: ${({ theme }) => theme.colorSubtitle}; font-size: 13px; }
      > span { border-radius: 999px; background: #e0f2fe; color: #0369a1; padding: 5px 9px; font-weight: 900; }
    }
  }

  .schedule-filters {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 220px;
    gap: 10px;
    margin-bottom: 12px;

    label { display: flex; align-items: center; gap: 8px; padding: 0 11px; border: 1px solid ${({ theme }) => theme.color2}; border-radius: 10px; background: ${({ theme }) => theme.bgtotal}; }
    input, select { min-width: 0; border: 1px solid ${({ theme }) => theme.color2}; border-radius: 10px; background: ${({ theme }) => theme.bgtotal}; color: inherit; padding: 10px; }
    label input { width: 100%; border: 0; background: transparent; }
  }

  .schedule-table { overflow-x: auto; border: 1px solid ${({ theme }) => theme.color2}; border-radius: 12px; }
  .schedule-directory-row { min-width: 930px; display: grid; grid-template-columns: 1.1fr .9fr .7fr .75fr 2.15fr; gap: 10px; align-items: center; padding: 11px 13px; border-bottom: 1px solid ${({ theme }) => theme.color2}; font-size: 13px; }
  .schedule-directory-row:last-child { border-bottom: 0; }
  .schedule-directory-row.head { background: ${({ theme }) => theme.bgtotal}; font-size: 11px; font-weight: 900; text-transform: uppercase; }
  .schedule-directory-row > span { color: ${({ theme }) => theme.colorSubtitle}; }
  .tag { display: inline-flex; justify-content: center; width: fit-content; border-radius: 999px; padding: 5px 8px; font-size: 11px; font-weight: 900; }
  .tag.active { background: #dcfce7; color: #166534; }
  .tag.inactive { background: #fee2e2; color: #b91c1c; }
  .schedule-actions, .form-actions { display: flex; flex-wrap: wrap; gap: 6px; }
  .mini, .schedule-pagination button, .schedule-form button { display: inline-flex; align-items: center; justify-content: center; gap: 5px; border: 1px solid ${({ theme }) => theme.color2}; border-radius: 8px; background: ${({ theme }) => theme.bgtotal}; color: inherit; padding: 7px 9px; font-size: 12px; font-weight: 800; cursor: pointer; }
  .mini.danger { color: #dc2626; }
  .empty-schedules { margin: 0; padding: 20px; text-align: center; color: ${({ theme }) => theme.colorSubtitle}; }
  .schedule-pagination { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 12px 0; color: ${({ theme }) => theme.colorSubtitle}; font-size: 12px; }
  .schedule-pagination > div { display: flex; align-items: center; gap: 8px; }
  .schedule-form { display: grid; grid-template-columns: 1.2fr .9fr .9fr .65fr auto; align-items: end; gap: 8px; border-top: 1px solid ${({ theme }) => theme.color2}; padding-top: 14px; }
  .schedule-form h4 { grid-column: 1 / -1; margin: 0; }
  .schedule-form > div:not(.form-actions) { display: contents; }
  .schedule-form input { min-width: 0; border: 1px solid ${({ theme }) => theme.color2}; border-radius: 10px; background: ${({ theme }) => theme.bgtotal}; color: inherit; padding: 10px; }
  .schedule-form .form-actions { grid-column: span 2; }
  .schedule-form .form-actions button:last-child { border: 0; background: #f3d20c; color: #111827; }

  button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  @media (max-width: 900px) {
    .attendance-layout {
      grid-template-columns: 1fr;
    }

    .schedule-card {
      position: static;
    }

    .schedule-form { grid-template-columns: 1fr 1fr; }
    .schedule-form h4, .schedule-form input[name="nombre"], .schedule-form .form-actions { grid-column: 1 / -1; }
  }

  @media (max-width: 650px) {
    .attendance-hero {
      align-items: start;
    }

    .today {
      display: none;
    }

    .client-card > header {
      grid-template-columns: auto minmax(0, 1fr);
    }

    .attendance-status {
      grid-column: 1 / -1;
      justify-self: start;
    }

    .client-facts,
    .attendance-actions {
      grid-template-columns: 1fr 1fr;
    }

    .schedule-row {
      grid-template-columns: 1fr;
    }

    .schedule-filters { grid-template-columns: 1fr; }
    .schedule-pagination { align-items: start; flex-direction: column; }
  }
`;

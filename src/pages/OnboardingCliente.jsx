import { useMemo, useState } from "react";
import styled from "styled-components";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCrmStore } from "../store/CrmStore";
import { v } from "../styles/variables";

function readForm(event) {
  event.preventDefault();
  return Object.fromEntries(new FormData(event.currentTarget).entries());
}

export function OnboardingCliente() {
  const [done, setDone] = useState(false);
  const { mostrarInvitacionActual, completarInvitacion } = useCrmStore();
  const invitationId = useMemo(
    () => new URLSearchParams(window.location.search).get("invitation"),
    []
  );
  const invitationQuery = useQuery({
    queryKey: ["crm-invitacion-actual", invitationId],
    queryFn: () => mostrarInvitacionActual({ invitationId }),
    refetchOnWindowFocus: false,
  });

  const mutation = useMutation({
    mutationFn: (values) =>
      completarInvitacion({
        invitacion: invitationQuery.data,
        cliente: {
          nombres: values.nombres,
          apellidos: values.apellidos || null,
          telefono: values.telefono || null,
          direccion: values.direccion || null,
          identificador_nacional: values.identificador_nacional || null,
          identificador_fiscal: values.identificador_fiscal || null,
          fecha_nacimiento: values.fecha_nacimiento || null,
          notas: values.notas || null,
        },
      }),
    onSuccess: () => setDone(true),
  });

  if (invitationQuery.isLoading) {
    return <Container><section>Cargando invitacion...</section></Container>;
  }

  if (done) {
    return (
      <Container>
        <section className="done">
          <span>ASC</span>
          <h1>Cuenta y suscripción activas</h1>
          <p>
            Tu perfil quedó registrado y el plan{" "}
            <strong>{invitationQuery.data?.plan_nombre}</strong> ya está activo.
          </p>
        </section>
      </Container>
    );
  }

  if (invitationQuery.error || !invitationQuery.data) {
    return (
      <Container>
        <section className="done">
          <span>ASC</span>
          <h1>Invitacion no disponible</h1>
          <p>Abre el enlace desde el correo de invitacion o solicita uno nuevo.</p>
        </section>
      </Container>
    );
  }

  return (
    <Container>
      <section>
        <span>ActiveSelfControl</span>
        <h1>Completa tus datos</h1>
        <p>
          Invitación para {invitationQuery.data.email}. Completa los datos y
          confirma una sola vez.
        </p>
        <article className="plan-card">
          <small>Plan asignado</small>
          <strong>{invitationQuery.data.plan_nombre}</strong>
          <span>
            {invitationQuery.data.plan_duracion_dias} días ·{" "}
            {invitationQuery.data.plan_periodicidad}
          </span>
        </article>
        {mutation.error && <p className="error">{mutation.error.message}</p>}
        <form onSubmit={(event) => mutation.mutate(readForm(event))}>
          <input name="nombres" placeholder="Nombres" required />
          <input name="apellidos" placeholder="Apellidos" />
          <input name="telefono" placeholder="Telefono" />
          <input name="direccion" placeholder="Direccion" />
          <input name="identificador_nacional" placeholder="Identificador nacional" />
          <input name="identificador_fiscal" placeholder="Identificador fiscal" />
          <input name="fecha_nacimiento" type="date" />
          <textarea name="notas" placeholder="Notas o preferencias" />
          <button disabled={mutation.isPending}>
            {mutation.isPending
              ? "Activando cuenta..."
              : "Aceptar invitación y activar cuenta"}
          </button>
        </form>
      </section>
    </Container>
  );
}

const Container = styled.main`
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 20px;
  background: ${({ theme }) => theme.bgtotal};
  color: ${({ theme }) => theme.text};

  section {
    width: min(560px, 100%);
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 8px;
    background: ${({ theme }) => theme.bgcards};
    padding: 24px;
  }

  span {
    color: ${v.colorPrincipal};
    font-weight: 900;
  }

  h1 {
    margin: 8px 0;
    letter-spacing: 0;
  }

  p {
    color: ${({ theme }) => theme.colorSubtitle};
  }

  form {
    display: grid;
    gap: 10px;
    margin-top: 16px;
  }

  .plan-card {
    display: grid;
    gap: 3px;
    margin-top: 16px;
    border: 1px solid rgba(243, 210, 12, 0.5);
    border-radius: 10px;
    background: rgba(243, 210, 12, 0.08);
    padding: 14px;

    small {
      color: ${({ theme }) => theme.colorSubtitle};
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
    }

    strong {
      font-size: 18px;
    }

    span {
      color: ${({ theme }) => theme.colorSubtitle};
      font-size: 12px;
    }
  }

  input,
  textarea {
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 6px;
    background: ${({ theme }) => theme.bgtotal};
    color: ${({ theme }) => theme.text};
    padding: 11px 12px;
    font: inherit;
  }

  textarea {
    min-height: 80px;
    resize: vertical;
  }

  button {
    min-height: 44px;
    border: 0;
    border-radius: 8px;
    background: ${v.colorPrincipal};
    color: #111;
    font-weight: 900;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  .done {
    text-align: center;
  }

  .error {
    color: ${v.colorError};
  }
`;

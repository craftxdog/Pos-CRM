import styled from "styled-components";
import fondocuadros from "../../assets/fondocuadros.svg";
import { Link } from "react-router-dom";
import { useEffect } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";
import { usePermisosStore } from "../../store/PermisosStore";

function isImageIcon(icon) {
  return /^https?:\/\//.test(icon || "") || /\.(svg|png|jpe?g|webp)$/i.test(icon || "");
}

function normalizeCard(item) {
  return item?.modulos || item;
}

const GROUPS = [
  {
    id: "administracion",
    title: "Administracion",
    description: "Empresa, usuarios, roles y estructura principal.",
  },
  {
    id: "pos",
    title: "POS y comprobantes",
    description: "Cobros, tickets, impresoras y numeracion.",
  },
  {
    id: "inventario",
    title: "Inventario y catalogo",
    description: "Productos, categorias, almacenes y proveedores.",
  },
  {
    id: "operacion",
    title: "Operacion diaria",
    description: "Clientes POS, sucursales y cajas.",
  },
  {
    id: "crm",
    title: "CRM",
    description: "Clientes, pagos, horarios, permisos y mensajes.",
  },
];

function resolveGroup(modulo) {
  if (modulo?.grupo) return modulo.grupo;
  if (modulo?.link?.includes("empresa") || modulo?.link?.includes("usuarios")) {
    return "administracion";
  }
  if (
    modulo?.link?.includes("ticket") ||
    modulo?.link?.includes("impresoras") ||
    modulo?.link?.includes("metodospago") ||
    modulo?.link?.includes("serializacion")
  ) {
    return "pos";
  }
  if (
    modulo?.link?.includes("almacenes") ||
    modulo?.link?.includes("productos") ||
    modulo?.link?.includes("categorias") ||
    modulo?.link?.includes("proveedores")
  ) {
    return "inventario";
  }
  if (modulo?.link?.startsWith("/crm")) return "crm";
  return "operacion";
}

export function ConfiguracionesTemplate({ items }) {
  const { dataPermisosConfiguracion } = usePermisosStore();
  const cards = (items || dataPermisosConfiguracion || []).map(normalizeCard);
  const groupedCards = GROUPS.map((group) => ({
    ...group,
    items: cards.filter((modulo) => resolveGroup(modulo) === group.id),
  })).filter((group) => group.items.length);

  useEffect(() => {
    const handleMouseMove = (event) => {
      document.querySelectorAll(".config-card").forEach((card) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--mouse-x", `${event.clientX - rect.left}px`);
        card.style.setProperty("--mouse-y", `${event.clientY - rect.top}px`);
      });
    };
    const cardsContainer = document.getElementById("config-sections");
    cardsContainer?.addEventListener("mousemove", handleMouseMove);
    return () => cardsContainer?.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <Container>
      <section className="config-header">
        <span>ASC</span>
        <h1>Configuracion</h1>
        <p>Administra empresa, POS, inventario, usuarios, CRM y comunicaciones.</p>
      </section>

      <div id="config-sections">
        {groupedCards.map((group) => (
          <section className="config-section" key={group.id}>
            <header>
              <h2>{group.title}</h2>
              <p>{group.description}</p>
            </header>
            <div className="config-cards">
              {group.items.map((modulo, index) => {
                const enabled = modulo.state ?? modulo.check ?? true;
                const icon = modulo.icono || "flat-color-icons:settings";
                return (
                  <Link
                    to={modulo.link || "#"}
                    className={enabled ? "config-card" : "config-card disabled"}
                    key={modulo.id || modulo.link || index}
                    onClick={(event) => {
                      if (!enabled) event.preventDefault();
                    }}
                  >
                    <span className="icon-box">
                      {isImageIcon(icon) ? <img src={icon} alt="" /> : <Icon icon={icon} />}
                    </span>
                    <span className="text-box">
                      <strong>{modulo.nombre}</strong>
                      <small>{modulo.descripcion}</small>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        {!cards.length && <div className="empty-state">No hay modulos de configuracion habilitados para este usuario.</div>}
      </div>
    </Container>
  );
}

const Container = styled.main`
  min-height: calc(100vh - 50px);
  margin-top: 50px;
  padding: 24px;
  display: grid;
  grid-template-rows: auto 1fr;
  align-content: start;
  gap: 16px;
  overflow: auto;
  background-color: ${({ theme }) => theme.bgtotal};
  background-image: url(${fondocuadros});
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
  color: ${({ theme }) => theme.text};

  .config-header,
  #config-sections {
    width: min(1180px, 100%);
    margin: 0 auto;
  }

  .config-header {
    display: grid;
    gap: 6px;

    span {
      color: ${({ theme }) => theme.colorSubtitle};
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0;
    }

    h1 {
      margin: 0;
      font-size: 30px;
      line-height: 1.1;
      letter-spacing: 0;
    }

    p {
      margin: 0;
      color: ${({ theme }) => theme.colorSubtitle};
      font-size: 14px;
    }
  }

  #config-sections {
    display: grid;
    gap: 18px;
  }

  .config-section {
    display: grid;
    gap: 10px;

    header {
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: 12px;
      border-bottom: 1px solid ${({ theme }) => theme.color2};
      padding-bottom: 8px;
    }

    h2 {
      margin: 0;
      font-size: 18px;
      letter-spacing: 0;
    }

    p {
      margin: 0;
      color: ${({ theme }) => theme.colorSubtitle};
      font-size: 13px;
      text-align: right;
    }
  }

  .config-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
  }

  .config-card {
    min-height: 132px;
    position: relative;
    overflow: hidden;
    display: grid;
    align-content: start;
    gap: 16px;
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 8px;
    padding: 16px;
    background: ${({ theme }) => theme.bgcards};
    color: ${({ theme }) => theme.text};
    text-decoration: none;
    transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;

    &:hover {
      transform: translateY(-2px);
      border-color: ${({ theme }) => theme.color1};
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);

      .icon-box svg,
      .icon-box img {
        transform: scale(1.05);
        filter: grayscale(0);
      }
    }

    &::after {
      content: "";
      position: absolute;
      inset: 0;
      opacity: 0;
      pointer-events: none;
      background: radial-gradient(
        520px circle at var(--mouse-x) var(--mouse-y),
        rgba(35, 171, 241, 0.15),
        transparent 42%
      );
      transition: opacity 0.2s ease;
    }

    &:hover::after {
      opacity: 1;
    }
  }

  .config-card.disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .icon-box {
    width: 54px;
    height: 54px;
    display: grid;
    place-items: center;
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 8px;
    background: ${({ theme }) => theme.bgtotal};

    svg,
    img {
      width: 34px;
      height: 34px;
      object-fit: contain;
      transition: 0.2s ease;
    }

    img {
      filter: grayscale(100%);
    }
  }

  .text-box {
    display: grid;
    gap: 8px;
    min-width: 0;

    strong {
      color: ${({ theme }) => theme.text};
      font-size: 16px;
      line-height: 1.2;
    }

    small {
      color: ${({ theme }) => theme.colorSubtitle};
      font-size: 13px;
      line-height: 1.35;
    }
  }

  .empty-state {
    min-height: 180px;
    display: grid;
    place-items: center;
    grid-column: 1 / -1;
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 8px;
    background: ${({ theme }) => theme.bgcards};
    color: ${({ theme }) => theme.text};
    text-align: center;
    padding: 18px;
  }

  @media (max-width: 700px) {
    padding: 14px;

    .config-section header {
      align-items: start;
      flex-direction: column;

      p {
        text-align: left;
      }
    }

    .config-cards {
      grid-template-columns: 1fr;
    }
  }
`;

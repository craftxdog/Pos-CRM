import styled from "styled-components";
import { CrmLinksArray, PosLinksArray, SecondarylinksArray } from "../../../utils/dataEstatica";
import { ToggleTema } from "../ToggleTema";
import { useAuthStore } from "../../../store/AuthStore";
import { v } from "../../../styles/variables";
import { NavLink } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useTenantAccessStore } from "../../../store/TenantAccessStore";


export function Sidebar({ state, setState }) {
  const {cerrarSesion} = useAuthStore()
  const { features } = useTenantAccessStore();
  const sections = [
    { label: "POS", enabled: features.pos, links: PosLinksArray },
    { label: "CRM", enabled: features.crm, links: CrmLinksArray },
  ];
  return (
    <Main $isopen={state.toString()}>
      <button
        className="Sidebarbutton"
        type="button"
        aria-label={state ? "Contraer menú lateral" : "Desplegar menú lateral"}
        aria-expanded={state}
        onClick={() => setState(!state)}
      >
        {<v.iconoflechaderecha />}
      </button>
      <Container $isopen={state.toString()} className={state ? "active" : ""}>
        <div className="Logocontent">
          <div className="imgcontent">
            <img src={v.logo} />
          </div>
          <h2>ASC</h2>
        </div>
        {sections.filter((section) => section.enabled).map((section) => (
          <section className="domain-section" key={section.label}>
            <span className="domain-label">{section.label}</span>
            {section.links.map(({ icon, label, to }) => (
          <div
            className={state ? "LinkContainer active" : "LinkContainer"}
            key={label}
          >
            <NavLink
              to={to}
              className={({ isActive }) => `Links${isActive ? ` active` : ``}`}
            >
              <section className={state ? "content open" : "content"}>
                <Icon className="Linkicon" icon={icon} />
                <span className={state ? "label_ver" : "label_oculto"}>
                  {label}
                </span>
              </section>
            </NavLink>
          </div>
            ))}
          </section>
        ))}
        <Divider />
        {SecondarylinksArray.map(({ icon, label, to, color }) => (
          <div
            className={state ? "LinkContainer active" : "LinkContainer"}
            key={label}
          >
            <NavLink
              to={to}
              className={({ isActive }) => `Links${isActive ? ` active` : ``}`}
            >
              <section className={state ? "content open" : "content"}>
                <Icon color={color} className="Linkicon" icon={icon} />
                <span className={state ? "label_ver" : "label_oculto"}>
                  {label}
                </span>
              </section>
            </NavLink>
          </div>
        ))}
        <div className={state ? "LinkContainer active" : "LinkContainer"}>
          <div className="Links" onClick={cerrarSesion} >
            <section className={state ? "content open" : "content"}>
              <Icon
                color="#CE82FF"
                className="Linkicon"
                icon="heroicons:ellipsis-horizontal-circle-solid"
              />
              <span  className={state ? "label_ver" : "label_oculto"}>SALIR</span>
            </section>
          </div>
         
         
        </div>

        <ToggleTema />
      </Container>
    </Main>
  );
}
const Container = styled.div`
  background: ${({ theme }) => theme.bgtotal};
  color: ${(props) => props.theme.text};
  position: fixed;
  padding: 12px 0 8px;
  z-index: 2;
  height: 100vh;
  height: 100dvh;
  width: 88px;
  transition: 0.1s ease-in-out;
  overflow-y: auto;
  overflow-x: hidden;
  border-right: 1px solid ${({ theme }) => theme.color2};
  
  &::-webkit-scrollbar {
    width: 6px;
    border-radius: 10px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: ${(props) => props.theme.colorScroll};
    border-radius: 10px;
  }

  &.active {
    width: 260px;
  }
  .Logocontent {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 50px;
    padding-bottom: 8px;
    .imgcontent {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 30px;
      cursor: pointer;
      transition: 0.3s ease;
      transform: ${({ $isopen }) =>
          $isopen === "true" ? `scale(0.7)` : `scale(1.5)`}
        rotate(${({ theme }) => theme.logorotate});
      img {
        width: 100%;
        animation: flotar 1.7s ease-in-out infinite alternate;
      }
    }
    h2 {
      color: #f88533;
      display: ${({ $isopen }) => ($isopen === "true" ? `block` : `none`)};
    }
  }
  .LinkContainer {
    margin: 3px 8px;
    transition: all 0.3s ease-in-out;
    position: relative;
    text-transform: uppercase;
    font-weight: 700;
  }
  .domain-section + .domain-section {
    border-top: 1px solid ${({ theme }) => theme.color2};
    padding-top: 4px;
  }
  .domain-label {
    display: ${({ $isopen }) => ($isopen === "true" ? "block" : "none")};
    padding: 2px 20px;
    font-size: 10px;
    letter-spacing: 0.16em;
    opacity: 0.55;
    font-weight: 800;
  }

  .Links {
    border-radius: 12px;
    display: flex;
    align-items: center;
    text-decoration: none;
    width: 100%;
    color: ${(props) => props.theme.text};
    min-height: 48px;
    position: relative;
    .content {
      display: flex;
      justify-content: center;
      width: 100%;
      align-items: center;
      .Linkicon {
        display: flex;
        font-size: 28px;
        filter: grayscale(100%);
        svg {
          font-size: 25px;
        }
      }

      .label_ver {
        transition: 0.3s ease-in-out;
        opacity: 1;
        display: initial;
        cursor: pointer;
      }
      .label_oculto {
        opacity: 0;
        display: none;
      }

      &.open {
        justify-content: start;
        gap: 16px;
        padding: 11px 16px;
      }
    }

    &:hover {
      background: ${(props) => props.theme.bgAlpha};
    }

    &.active {
      background: ${(props) => props.theme.bg6};
      border: 2px solid ${(props) => props.theme.bg5};
      color: ${(props) => props.theme.color1};
      font-weight: 600;
      .Linkicon{
        filter: grayscale(0%);
      }
    }
  }

  @media (max-height: 760px) {
    padding-top: 6px;
    .Logocontent {
      min-height: 40px;
      padding-bottom: 2px;
    }
    .LinkContainer {
      margin-block: 1px;
    }
    .Links {
      min-height: 41px;
    }
    .domain-label {
      padding-block: 1px;
    }
  }
`;
const Main = styled.div`
  .Sidebarbutton {
    position: fixed;
    top: 70px;
    left: 68px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: ${(props) => props.theme.bgtgderecha};
    box-shadow: 0 0 4px ${(props) => props.theme.bg3},
      0 0 7px ${(props) => props.theme.bg};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    border: 0;
    z-index: 3;
    transform: ${({ $isopen }) =>
      $isopen === "true" ? `translateX(173px) rotate(3.142rad)` : `initial`};
    color: ${(props) => props.theme.text};
  }
`;
const Divider = styled.div`
  height: 1px;
  width: 100%;
  background: ${(props) => props.theme.bg4};
  margin: 5px 0;
`;

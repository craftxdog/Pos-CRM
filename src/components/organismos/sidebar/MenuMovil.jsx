import styled from "styled-components";
import { CrmLinksArray, PosLinksArray, SecondarylinksArray } from "../../../utils/dataEstatica";
import { ToggleTema } from "../ToggleTema";
import { v } from "../../../styles/variables";
import { NavLink } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useTenantAccessStore } from "../../../store/TenantAccessStore";
export const MenuMovil = ({ setState }) => {
  const state = true;
  const { features } = useTenantAccessStore();
  const sections = [
    { label: "PUNTO DE VENTA", enabled: features.pos, links: PosLinksArray },
    { label: "CRM", enabled: features.crm, links: CrmLinksArray },
  ];

  return (
    <Overlay onClick={setState}>
      <Container
        $isopen={state.toString()}
        className={state ? "active" : ""}
        onClick={(event) => event.stopPropagation()}
      >
          <div className="Logocontent">
            <div className="imgcontent">
              <img src={v.logo} />
            </div>
            <h2>ASC</h2>
          </div>
          {sections.filter((section) => section.enabled).map((section) => (
            <section key={section.label}>
              <div className="domain-label">{section.label}</div>
              {section.links.map(({ icon, label, to }) => (
            <div
              onClick={setState}
              className={state ? "LinkContainer active" : "LinkContainer"}
              key={label}
            >
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `Links${isActive ? ` active` : ``}`
                }
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
              onClick={setState}
            >
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `Links${isActive ? ` active` : ``}`
                }
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
          <ToggleTema />
      </Container>
    </Overlay>
  );
};
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1050;
  display: flex;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(3px);
`;
const Container = styled.div`
  background: ${({ theme }) => theme.bgtotal};
  color: ${(props) => props.theme.text};
  width: min(340px, calc(100vw - 28px));
  height: 100vh;
  height: 100dvh;
  padding: calc(64px + env(safe-area-inset-top)) 10px
    max(20px, env(safe-area-inset-bottom));
  transition: 0.1s ease-in-out;
  overflow-y: auto;
  overflow-x: hidden;
  border-right: 2px solid ${({ theme }) => theme.color2};

  &::-webkit-scrollbar {
    width: 6px;
    border-radius: 10px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: ${(props) => props.theme.colorScroll};
    border-radius: 10px;
  }

  .Logocontent {
    display: flex;
    justify-content: center;
    align-items: center;

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
    margin: 9px 0;
    margin-right: 10px;
    margin-left: 8px;
    transition: all 0.3s ease-in-out;
    position: relative;
    text-transform: uppercase;
    font-weight: 700;
  }
  .domain-label {
    padding: 14px 20px 4px;
    font-size: 11px;
    letter-spacing: 0.14em;
    opacity: 0.6;
    font-weight: 800;
  }

  .Links {
    border-radius: 12px;
    display: flex;
    align-items: center;
    text-decoration: none;
    width: 100%;
    color: ${(props) => props.theme.text};
    height: 60px;
    position: relative;
    .content {
      display: flex;
      justify-content: center;
      width: 100%;
      align-items: center;
      .Linkicon {
        display: flex;
        font-size: 33px;

        svg {
          font-size: 25px;
        }
      }

      .label_ver {
        transition: 0.3s ease-in-out;
        opacity: 1;
        display: initial;
      }
      .label_oculto {
        opacity: 0;
        display: none;
      }

      &.open {
        justify-content: start;
        gap: 20px;
        padding: 20px;
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
    }
  }
`;
const Divider = styled.div`
  height: 1px;
  width: 100%;
  background: ${(props) => props.theme.bg4};
  margin: ${() => v.lgSpacing} 0;
`;

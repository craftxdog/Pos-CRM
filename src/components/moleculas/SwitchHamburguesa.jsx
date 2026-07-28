import styled from "styled-components";
export function SwitchHamburguesa({ state, setstate }) {
  return (
    <Container
      type="button"
      aria-label={state ? "Cerrar menú" : "Abrir menú"}
      aria-expanded={state}
      onClick={setstate}
    >
      <span className={state ? "toggle active" : "toggle"}>
        <span className="bars" id="bar1"></span>
        <span className="bars" id="bar2"></span>
        <span className="bars" id="bar3"></span>
      </span>
    </Container>
  );
}
const Container = styled.button`
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid ${({ theme }) => theme.color2};
  border-radius: 12px;
  background: ${({ theme }) => theme.bgtotal};
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.text};
  cursor: pointer;
  z-index: 1101;
  .toggle {
    position: relative;
    width: 40px;
    height: 40px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    transition-duration: 0.3s;
    transform: scale(0.48);
    &.active {
      .bars {
        margin-left: 13px;
      }
      #bar2 {
        transform: rotate(135deg);
        margin-left: 0;
        transform-origin: center;
        transition-duration: 0.3s;
      }
      #bar1 {
        transform: rotate(45deg);
        transition-duration: 0.3s;
        transform-origin: left center;
      }
      #bar3 {
        transform: rotate(-45deg);
        transition-duration: 0.3s;
        transform-origin: left center;
      }
    }
  }

  .bars {
    width: 100%;
    height: 4px;
    background-color: ${({ theme }) => theme.text};
    border-radius: 5px;
    transition-duration: 0.3s;
  }
`;

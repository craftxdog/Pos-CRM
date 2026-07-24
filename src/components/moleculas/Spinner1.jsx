import styled from "styled-components";

export function Spinner1() {
  return (
    <Container role="status" aria-label="Cargando">
      <div className="loader" />
    </Container>
  );
}

const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;

  .loader {
    width: 82px;
    height: 82px;
    border-radius: 50%;
    border: 8px solid rgba(127, 60, 235, 0.18);
    border-top-color: #7f3ceb;
    animation: asc-spin 0.75s linear infinite;
  }

  @keyframes asc-spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

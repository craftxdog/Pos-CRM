import styled from "styled-components";
import {
  Btn1,
  Footer,
  InputText2,
  Linea,
  Title,
  useAuthStore,
} from "../../index";
import { v } from "../../styles/variables";
import { Device } from "../../styles/breakpoints";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { toast, Toaster } from "sonner";
import { useState } from "react";
import { FiShoppingBag, FiShield } from "react-icons/fi";
import { CardModos } from "../organismos/LoginDesign/CardModos";
import { VolverBtn } from "../moleculas/VolverBtn";
export function LoginTemplate() {
  const [stateModos, setStateModos] = useState(true);
  const [stateModo, setStateModo] = useState("empleado");
  const { loginGoogle, loginEmail, loginInvitadoQA } = useAuthStore();

  const { register, handleSubmit } = useForm();
  const { mutate } = useMutation({
    mutationKey: ["iniciar con email"],
    mutationFn: loginEmail,
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });
  const { mutate: mutateInvitado, isPending: isPendingInvitado } = useMutation({
    mutationKey: ["iniciar modo invitado qa"],
    mutationFn: loginInvitadoQA,
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });
  const { mutate: mutateGoogle, isPending: isPendingGoogle } = useMutation({
    mutationKey: ["iniciar con google"],
    mutationFn: loginGoogle,
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });
  const manejadorEmailSesion = (data) => {
    mutate({ email: data.email, password: data.password });
  };
  const manejarCrearUSerTester = () => {
    mutateInvitado();
  };
  return (
    <Container>
      <Toaster />
      <div className="card">
        <ContentLogo>
          <img src={v.logo} />
          <span>ASC - ActiveSelfControl</span>
        </ContentLogo>
        <Title $paddingbottom="40px">Ingresar Modo</Title>
        {stateModos && (
          <ContentModos>
            <CardModos
              title={"Super admin"}
              subtitle={"crea y gestiona tu empresa"}
              bgcolor={"#ed7323"}
              icon={FiShield}
              funcion={() => {
                setStateModo("superadmin");
                setStateModos(!stateModos);
              }}
            />
            <CardModos
              title={"Empleado"}
              subtitle={"vende y crece"}
              bgcolor={"#542a1b"}
              icon={FiShoppingBag}
              funcion={() => {
                setStateModo("empleado");
                setStateModos(!stateModos);
              }}
            />
          </ContentModos>
        )}
        {stateModos === false && (
          <PanelModo>
            <VolverBtn funcion={() => setStateModos(!stateModos)} />
            <span>
              {stateModo === "superadmin" ? "Modo super admin" : "Modo empleado"}
            </span>
            <form onSubmit={handleSubmit(manejadorEmailSesion)}>
              <InputText2>
                <input
                  className="form__field"
                  placeholder="email"
                  type="email"
                  autoComplete="email"
                  {...register("email", { required: true })}
                />
              </InputText2>
              <InputText2>
                <input
                  className="form__field"
                  placeholder="contraseña"
                  type="password"
                  autoComplete="current-password"
                  {...register("password", { required: true })}
                />
              </InputText2>
              <Btn1
                border="2px"
                titulo="INGRESAR"
                bgcolor={stateModo === "superadmin" ? "#ed7323" : "#1CB0F6"}
                color="255,255,255"
                width="100%"
              />
            </form>
            {stateModo === "superadmin" && import.meta.env.DEV && (
              <>
                <Btn1
                  disabled={isPendingInvitado}
                  funcion={manejarCrearUSerTester}
                  border="2px"
                  titulo="MODO INVITADO QA"
                  bgcolor="#f6ce1c"
                  color="255,255,255"
                  width="100%"
                />
                <Linea>
                  <span>o</span>
                </Linea>
              </>
            )}
            {stateModo === "superadmin" && (
              <Btn1
                disabled={isPendingGoogle}
                border="2px"
                funcion={() => mutateGoogle()}
                titulo="Google"
                bgcolor="#fff"
                icono={<v.iconogoogle />}
              />
            )}
          </PanelModo>
        )}
      </div>
      <Footer />
    </Container>
  );
}
const Container = styled.div`
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  flex-direction: column;
  padding: max(18px, env(safe-area-inset-top)) 12px
    max(12px, env(safe-area-inset-bottom));
  color: ${({ theme }) => theme.text};
  .card {
    display: flex;
    flex-direction: column;
    justify-content: center;
    flex: 1;
    min-height: 0;
    width: 100%;
    max-width: 430px;
    margin: 0 auto;
    @media ${Device.tablet} {
      width: 400px;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
  }
`;
const ContentLogo = styled.section`
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 12px;
  gap: 8px;
  span {
    font-weight: 700;
  }
  img {
    width: 40px;
    flex: none;
  }
`;
const ContentModos = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;
const PanelModo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

import styled from "styled-components";
import { v } from "../../../styles/variables";
import {
  Btn1,
  ConvertirCapitalize,
  useClientesProveedoresStore,
} from "../../../index";
import { useForm } from "react-hook-form";
import { useEmpresaStore } from "../../../store/EmpresaStore";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

export function RegistrarClientesProveedores({
  onClose,
  dataSelect,
  accion,
  setIsExploding,
}) {
  const { insertarCliPro, editarCliPro, tipo } = useClientesProveedoresStore();
  const { dataempresa } = useEmpresaStore();

  const {
    register,
    formState: { errors },
    handleSubmit,
  } = useForm({
    defaultValues: {
      nombres: dataSelect?.nombres || "",
      direccion: dataSelect?.direccion || "",
      telefono: dataSelect?.telefono || "",
      email: dataSelect?.email || "",
      identificador_nacional: dataSelect?.identificador_nacional || "",
      identificador_fiscal: dataSelect?.identificador_fiscal || "",
    },
  });
  const { isPending, mutate: doInsertar } = useMutation({
    mutationFn: insertar,
    mutationKey: "insertar clientes proveedores mutation",
    onError: (err) => toast.error(`No se pudo guardar: ${err.message}`),
    onSuccess: () => cerrarFormulario(),
  });
  const handlesub = (data) => {
    doInsertar(data);
  };
  const cerrarFormulario = () => {
    onClose();
    setIsExploding(true);
  };
  async function insertar(data) {
    if (accion === "Editar") {
      const p = {
        _id: dataSelect.id,
        _nombres: ConvertirCapitalize(data.nombres),
        _id_empresa: dataempresa?.id,
        _direccion: data.direccion,
        _telefono: data.telefono,
        _email: data.email,
        _identificador_nacional: data.identificador_nacional,
        _identificador_fiscal: data.identificador_fiscal,
        _tipo: tipo,
      };
      await editarCliPro(p);
    } else {
      const p = {
        _nombres: ConvertirCapitalize(data.nombres),
        _id_empresa: dataempresa?.id,
        _direccion: data.direccion,
        _telefono: data.telefono,
        _email: data.email,
        _identificador_nacional: data.identificador_nacional,
        _identificador_fiscal: data.identificador_fiscal,
        _tipo: tipo,
      };

      await insertarCliPro(p);
    }
  }

  return (
    <Container>
      {isPending ? (
        <span>...🔼</span>
      ) : (
        <div className="sub-contenedor">
          <div className="headers">
            <section>
              <h1>
                {accion == "Editar"
                  ? "Editar " + tipo
                  : "Registrar nuevo " + tipo}
              </h1>
            </section>

            <section>
              <span onClick={onClose}>x</span>
            </section>
          </div>

          <form className="formulario" onSubmit={handleSubmit(handlesub)}>
            <section className="form-subcontainer">
              <label>
                <span>Nombre completo *</span>
                  <input
                    type="text"
                    autoFocus
                    autoComplete="name"
                    placeholder="Ej. María José López"
                    {...register("nombres", {
                      required: true,
                    })}
                  />
                  {errors.nombres?.type === "required" && (
                    <p>Campo requerido</p>
                  )}
              </label>
              <label>
                <span>Correo electrónico</span>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="cliente@correo.com"
                    {...register("email")}
                  />
                <small>Se usa para facturas, recibos e invitaciones.</small>
              </label>
              <label>
                <span>Teléfono / WhatsApp</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+505 8888 8888"
                    {...register("telefono")}
                  />
              </label>
              <label>
                <span>Dirección física</span>
                  <input
                    type="text"
                    autoComplete="street-address"
                    placeholder="Barrio, calle y referencia"
                    {...register("direccion")}
                  />
                <small>No escribas el correo en este campo.</small>
              </label>
              <label>
                <span>Identificación nacional</span>
                  <input
                    type="text"
                    placeholder="13 números y una letra (opcional)"
                    {...register("identificador_nacional", {
                      pattern: /^[0-9]{13}[A-Za-z]$/,
                      setValueAs: (value) => value?.trim().toUpperCase(),
                    })}
                  />
                  {errors.identificador_nacional?.type === "pattern" && (
                    <p>Usa 13 números y una letra final.</p>
                  )}
              </label>
              <label>
                <span>Identificación fiscal</span>
                  <input
                    type="text"
                    placeholder="RUC o documento fiscal (opcional)"
                    {...register("identificador_fiscal")}
                  />
              </label>
              <Btn1
                icono={<v.iconoguardar />}
                titulo="Guardar"
                bgcolor="#F9D70B"
              />
            </section>
          </form>
        </div>
      )}
    </Container>
  );
}
const Container = styled.div`
  transition: 0.5s;
  top: 0;
  left: 0;
  position: fixed;
  background-color: rgba(10, 9, 9, 0.5);
  display: flex;
  width: 100%;
  min-height: 100vh;
  align-items: center;
  justify-content: center;
  z-index: 1000;

  .sub-contenedor {
    position: relative;
    width: 500px;
    max-width: 85%;
    border-radius: 20px;
    background: ${({ theme }) => theme.bgtotal};
    box-shadow: -10px 15px 30px rgba(10, 9, 9, 0.4);
    padding: 22px 28px 24px;
    z-index: 100;

    .headers {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;

      h1 {
        font-size: 22px;
        font-weight: 800;
      }
      span {
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        border-radius: 10px;
        background: ${({ theme }) => theme.bgAlpha};
        font-size: 18px;
        cursor: pointer;
      }
    }
    .formulario {
      .form-subcontainer {
        gap: 13px;
        display: flex;
        flex-direction: column;
        label {
          display: grid;
          gap: 6px;
          color: ${({ theme }) => theme.text};
          font-size: 13px;
          font-weight: 750;
        }
        input {
          width: 100%;
          box-sizing: border-box;
          padding: 12px 13px;
          border: 1px solid ${({ theme }) => theme.color2};
          border-radius: 10px;
          outline: none;
          background: ${({ theme }) => theme.bgtotal};
          color: ${({ theme }) => theme.text};
          font: inherit;
          font-weight: 500;
        }
        input:focus {
          border-color: #0ea5e9;
          box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.14);
        }
        small {
          color: ${({ theme }) => theme.colorSubtitle};
          font-size: 11px;
          font-weight: 500;
        }
        p {
          margin: 0;
          color: #dc2626;
          font-size: 11px;
        }
        .colorContainer {
          .colorPickerContent {
            padding-top: 15px;
            min-height: 50px;
          }
        }
      }
    }
  }
  @media (max-width: 560px) {
    align-items: flex-start;
    padding: 16px 0;
    overflow-y: auto;
    .sub-contenedor {
      width: calc(100% - 24px);
      max-width: none;
      padding: 18px;
    }
  }
`;

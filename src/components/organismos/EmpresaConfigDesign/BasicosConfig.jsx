import { Icon } from "@iconify/react/dist/iconify.js";
import React from "react";
import styled from "styled-components";
import { InputText2 } from "../formularios/InputText2";
import { Btn1 } from "../../moleculas/Btn1";
import { useForm } from "react-hook-form";
import { useEmpresaStore } from "../../../store/EmpresaStore";
import { slideBackground } from "../../../styles/keyframes";

import { useUpdateEmpresaMutation } from "../../../tanstack/EmpresaStack";
import { ImageSelector } from "../../../hooks/useImageSelector";
import { useGlobalStore } from "../../../store/GlobalStore";
export const BasicosConfig = () => {
  const { fileUrl } = useGlobalStore();

  const { dataempresa } = useEmpresaStore();

  const {
    register,
    formState: { errors },
    handleSubmit,
    
  } = useForm({
    defaultValues:{
      nombre:dataempresa?.nombre,
      direccion:dataempresa?.direccion_fiscal,
      impuesto:dataempresa?.impuesto,
      valor_impuesto: dataempresa?.valor_impuesto,
      precios_incluyen_impuesto: dataempresa?.precios_incluyen_impuesto !== false,
    }
  });


  const { mutate, isPending } = useUpdateEmpresaMutation();

  return (
    <Container>
      {isPending ? (
        <span>guardando...🐖</span>
      ) : (
        <>
          <Title>Básico</Title>

          <Avatar>
            <span className="nombre">{dataempresa?.nombre}</span>
            <ImageSelector fileUrl={fileUrl || dataempresa?.logo} />
            
          </Avatar>
          <form onSubmit={handleSubmit(mutate)}>
            <Label>Nombre</Label>
            <InputText2>
              <input
                className="form__field"
                placeholder="nombre"
                type="text"
               
                {...register("nombre", {
                  required: true,
                })}
              />
              {errors.nombre?.type === "required" && <p>Campo requerido</p>}
            </InputText2>
            <Label>Dirección</Label>
            <InputText2>
              <input
                
                className="form__field"
                placeholder="direccion"
                type="text"
                {...register("direccion", {
                  required: true,
                })}
              />
              {errors.direccion?.type === "required" && <p>Campo requerido</p>}
            </InputText2>
            <Label>Impuesto</Label>
            <InputText2>
              <input
             
                className="form__field"
                placeholder="impuesto"
                type="text"
                {...register("impuesto", {
                  required: true,
                })}
              />
              {errors.impuesto?.type === "required" && <p>Campo requerido</p>}
            </InputText2>
            <Label>Porcentaje de impuesto (0 a 100)</Label>
            <InputText2>
              <input
                step="0.01"
              
                className="form__field"
                placeholder="valor impuesto"
                type="number"
                {...register("valor_impuesto", {
                  required: true,
                  min: 0,
                  max: 100,
                })}
              />
              {errors.valor_impuesto?.type === "required" && (
                <p>Campo requerido</p>
              )}
            </InputText2>
            <label className="tax-mode">
              <input type="checkbox" {...register("precios_incluyen_impuesto")} />
              <span>Los precios de venta ya incluyen el impuesto</span>
            </label>
            <br></br>
            <Btn1 bgcolor="#0930bb" color="#fff" titulo="GUARDAR CAMBIOS" />
          </form>
          <br></br>
          <section className="advertencia">
            <Icon className="icono" icon="meteocons:barometer" />
            <span>
              los cambios de logo se ven reflejados en el lapso de 10 segundos.
            </span>
          </section>
        </>
      )}
    </Container>
  );
};
const Container = styled.div`
  padding: 20px;
  border-radius: 10px;
  max-width: 400px;
  margin: 0 auto;
  p {
    color: #f75510;
    font-weight: 700;
  }
  .tax-mode {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 14px;
    font-weight: 650;
    input { width: 18px; height: 18px; }
  }
  .advertencia {
    background-color: rgba(237, 95, 6, 0.2);
    border-radius: 10px;
    padding: 10px;
    margin-top: 10px;
    margin: auto;
    height: 70px;
    display: flex;
    color: #f75510;
    width: 100%;
    align-items: center;
    .icono {
      font-size: 100px;
    }
  }
`;

const Title = styled.h1`
  font-size: 24px;
  margin-bottom: 20px;
`;

const Avatar = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  position: relative;
  width: 100%;
  border-radius: 10px;
  padding: 10px;
  .nombre {
    font-weight: 700;
    position: absolute;
    text-align: center;
    align-self: center;
    margin: auto;
    top: 0;
    left: 100px;
    bottom: 0;
    right: 10px;
    font-size: 25px;
    overflow: hidden; /* Para asegurarse de que el contenido adicional esté oculto */
    white-space: normal; /* Permite el salto de línea */
    word-wrap: break-word; /* Rompe las palabras largas y las envuelve a la siguiente línea */
    color: #fff !important;
  }
  background-color: #391ebb;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 120 120'%3E%3Cpolygon fill='%23000' fill-opacity='0.19' points='120 0 120 60 90 30 60 0 0 0 0 0 60 60 0 120 60 120 90 90 120 60 120 0'/%3E%3C/svg%3E");

  background-size: 60px 60px;
  animation: ${slideBackground} 10s linear infinite;
  img {
    object-fit: cover;
  }
  input {
    display: none;
  }
`;

const AvatarImage = styled.img`
  width: 80px;
  height: 80px;
  border-radius: 10px;
  margin-right: 10px;
`;

const EditButton = styled.button`
  background-color: #00aaff;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  width: 30px;
  height: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
  position: absolute;
  left: 60px;
  top: 10px;
  margin: auto;
  .icono {
    font-size: 20px;
  }
`;

const Label = styled.label`
  display: block;
  margin: 10px 0 5px;
`;

const Button = styled.button`
  width: 100%;
  padding: 10px;
  margin-top: 20px;
  border: none;
  border-radius: 5px;
  background-color: #00aaff;
  color: #fff;
  cursor: pointer;
`;

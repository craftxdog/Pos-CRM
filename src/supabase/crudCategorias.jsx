import { hasImageFile } from "../utils/catalogImages";
import { uploadCatalogImage, removeCatalogImage } from "./catalogImageStorage";
import { supabase } from "./supabase.config";

const tabla = "categorias";

async function editarIconoCategoria(id, icono) {
  const { error } = await supabase
    .from(tabla)
    .update({ icono })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function InsertarCategorias(p, file) {
  const { error, data: id } = await supabase.rpc("insertarcategorias", p);
  if (error) throw new Error(error.message);

  if (hasImageFile(file)) {
    const image = await uploadCatalogImage({
      companyId: p._id_empresa,
      entity: "categorias",
      recordId: id,
      file,
    });
    await editarIconoCategoria(id, image.publicUrl);
  }
}

export async function MostrarCategorias(p) {
  const { data, error } = await supabase
    .from(tabla)
    .select()
    .eq("id_empresa", p.id_empresa)
    .order("id", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function BuscarCategorias(p) {
  const { data, error } = await supabase
    .from(tabla)
    .select()
    .eq("id_empresa", p.id_empresa)
    .ilike("nombre", `%${p.descripcion}%`);
  if (error) throw new Error(error.message);
  return data;
}

export async function EliminarCategorias(p) {
  const { error } = await supabase.from(tabla).delete().eq("id", p.id);
  if (error) throw new Error(error.message);

  if (p.id_empresa && p.icono && p.icono !== "-") {
    await removeCatalogImage({
      companyId: p.id_empresa,
      entity: "categorias",
      recordId: p.id,
    });
  }
}

export async function EditarCategorias(p, filenew) {
  const { error } = await supabase.rpc("editarcategorias", p);
  if (error) throw new Error(error.message);

  if (hasImageFile(filenew)) {
    const image = await uploadCatalogImage({
      companyId: p._id_empresa,
      entity: "categorias",
      recordId: p._id,
      file: filenew,
    });
    await editarIconoCategoria(p._id, image.publicUrl);
  }
}

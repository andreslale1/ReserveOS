import { redirect } from "next/navigation";

// /reservar se conserva para los enlaces ya compartidos; el portal completo vive en /cuenta.
export default function ReservarPage() {
  redirect("/cuenta/clases");
}

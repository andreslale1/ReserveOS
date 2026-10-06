import { headers } from "next/headers";

// Manifiesto de la app instalable. En el dominio de un estudio, la app lleva su nombre; en reserveos.app, el de ReserveOS.
export async function GET() {
  const h = await headers();
  const nombre = decodeURIComponent(h.get("x-tenant-nombre") ?? "") || "ReserveOS";
  return Response.json(
    {
      name: nombre,
      short_name: nombre.length > 12 ? nombre.slice(0, 12) : nombre,
      description: "Reserva tus clases y administra tus paquetes.",
      start_url: "/cuenta",
      scope: "/",
      display: "standalone",
      background_color: "#F3EEE7",
      theme_color: "#111111",
      lang: "es",
      icons: [
        { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/pwa-icon/512?m=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } },
  );
}

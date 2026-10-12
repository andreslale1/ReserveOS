import type { NextConfig } from "next";

const base = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];
// Nada de la app puede incrustarse en otra web (login, cuenta, panel, consola, API...): evita clickjacking sobre pantallas con sesión.
const noIncrustar = [...base, { key: "X-Frame-Options", value: "DENY" }, { key: "Content-Security-Policy", value: "frame-ancestors 'none'" }];
// Excepción deliberada: la página pública del estudio (/e/{slug}) sí se puede mostrar dentro de la web del estudio.
// No tiene sesión ni acciones sensibles; sus botones abren el login/registro en la ventana completa (target=_top).
const incrustable = [...base, { key: "Content-Security-Policy", value: "frame-ancestors *" }];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async headers() {
    return [
      { source: "/e/:slug", headers: incrustable },
      { source: "/e/:slug/:resto+", headers: noIncrustar },
      { source: "/((?!e/).*)", headers: noIncrustar },
    ];
  },
};

export default nextConfig;

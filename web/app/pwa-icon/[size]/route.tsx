import { ImageResponse } from "next/og";
import { headers } from "next/headers";

export async function GET(req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const px = size === "192" ? 192 : 512;
  const maskable = new URL(req.url).searchParams.get("m") === "1";
  const nombre = decodeURIComponent((await headers()).get("x-tenant-nombre") ?? "") || "ReserveOS";
  const letra = nombre.trim().charAt(0).toUpperCase() || "R";
  const margen = maskable ? px * 0.2 : px * 0.12;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#111111" }}>
        <div style={{ width: px - margen * 2, height: px - margen * 2, borderRadius: "50%", background: "#E8B89B", display: "flex", alignItems: "center", justifyContent: "center", color: "#111111", fontSize: (px - margen * 2) * 0.58, fontWeight: 800 }}>
          {letra}
        </div>
      </div>
    ),
    { width: px, height: px },
  );
}

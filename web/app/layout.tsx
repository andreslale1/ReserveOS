import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({ variable: "--f-display", subsets: ["latin"], weight: ["500", "600", "700"] });
const body = Instrument_Sans({ variable: "--f-body", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "ReserveOS — El sistema operativo de tu estudio",
  description:
    "Reservas, membresías, pagos y clientas en un solo lugar. ReserveOS es el software que corre detrás de estudios de pilates y fitness reales.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "ReserveOS", statusBarStyle: "default" },
  icons: { apple: "/pwa-icon/192" },
};

export const viewport: Viewport = {
  themeColor: "#2f5d8c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-cream text-ink">
        {children}
      </body>
    </html>
  );
}

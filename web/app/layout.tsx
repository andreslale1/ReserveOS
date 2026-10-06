import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ReserveOS — El sistema operativo de tu estudio",
  description:
    "Reservas, membresías, pagos y clientas en un solo lugar. ReserveOS es el software que corre detrás de estudios de pilates y fitness reales.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "ReserveOS", statusBarStyle: "default" },
  icons: { apple: "/pwa-icon/192" },
};

export const viewport: Viewport = {
  themeColor: "#111111",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-cream text-ink">
        {children}
      </body>
    </html>
  );
}

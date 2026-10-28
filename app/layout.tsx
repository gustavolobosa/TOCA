import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "TOCA",
  description: "Enlaces NFC dinámicos y medibles.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Revela } from "./revela";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cadencia",
  description:
    "Sistema de contenido para dueños de negocio que ya venden.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Sin JavaScript no corre el observador, y lo que espera a que lo
            miren se quedaría en opacidad cero para siempre. La portada es una
            página de venta: tiene que leerse aunque el script no llegue. */}
        <noscript>
          <style>{".revela{opacity:1!important;transform:none!important}"}</style>
        </noscript>
      </head>
      <body className="min-h-full flex flex-col">
        <Revela />
        {children}
      </body>
    </html>
  );
}

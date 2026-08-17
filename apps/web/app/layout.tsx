import type { Metadata } from "next";
import { ToastProvider } from "@ngc/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "Neema Gospel Choir — ERP",
  description: "Institutional ERP platform for Neema Gospel Choir (NGC).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

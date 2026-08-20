import type { Metadata } from "next";
import "./globals.css";
import "./components.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Noor Core",
  description: "Operations dashboard — every step of every order is approved here.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="text-sm">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Director's Sandbox",
  description: "Generate an AI world, then direct it in real time.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div id="app-root">{children}</div>
      </body>
    </html>
  );
}

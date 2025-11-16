import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Craftea - 3D Structure Design",
  description: "Web-based 3D structure design tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

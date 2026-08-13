import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ToolNest Website Intelligence Command Center",
  description:
    "Private website technical SEO, performance and website intelligence workspace.",
  robots: {
    index: false,
    follow: false
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

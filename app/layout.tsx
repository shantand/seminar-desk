import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Seminar Desk",
  description: "Webinar registrations, personal invitations, and the next conversation.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Seminar Desk", statusBarStyle: "default" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icon-180.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

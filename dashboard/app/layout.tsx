import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CutGuard AI — Autonomous Video Transcoding SRE Agent",
  description: "Autonomous incident triage and remediation agent for cloud media rendering and transcoding pipelines.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
        {children}
      </body>
    </html>
  );
}

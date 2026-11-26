import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import type { Metadata } from "next";
import { AxonProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: "AXON · Onboarding and knowledge transfer",
  description: "Evidence-based onboarding readiness for Engineering Albania (hackathon prototype, fictional data).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><AxonProvider>{children}</AxonProvider></body>
    </html>
  );
}

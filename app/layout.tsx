import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MedSafe | Understand your medicines",
  description: "A calm, clear medicine interaction checker for families and care teams.",
  icons: { icon: "/medsafe-logo.svg", shortcut: "/medsafe-logo.svg", apple: "/medsafe-logo.svg" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

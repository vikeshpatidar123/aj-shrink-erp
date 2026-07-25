import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";
import { DeviceProvider } from "@/contexts/DeviceContext";
import { SearchPreferencesProvider } from "@/contexts/SearchPreferencesContext";
import { ModuleAuthProvider } from "@/contexts/ModuleAuthContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { GlobalAlertProvider } from "@/contexts/GlobalAlertContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Indus Analytics ERP",
  description: "Indus Analytics ERP – Extrusion & Rotogravure",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <DeviceProvider>
          <GlobalAlertProvider>
            <CurrencyProvider>
              <ModuleAuthProvider>
                <SearchPreferencesProvider>
                  <AppShell>{children}</AppShell>
                </SearchPreferencesProvider>
              </ModuleAuthProvider>
            </CurrencyProvider>
          </GlobalAlertProvider>
        </DeviceProvider>
      </body>
    </html>
  );
}

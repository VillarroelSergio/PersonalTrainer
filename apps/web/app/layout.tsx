import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "@/styles/app.css";
import { OfflineSyncProvider } from "@/lib/offline/OfflineSyncContext";
import { OfflineDataProvider } from "@/lib/offline/OfflineDataContext";
import { PwaRegister } from "@/lib/offline/PwaRegister";

export const metadata: Metadata = { title: "Trainer", description: "Fundación privada de Trainer", manifest: "/manifest.webmanifest", appleWebApp: { capable: true, title: "Trainer", statusBarStyle: "black-translucent" } };
export const viewport: Viewport = { themeColor: "#171613" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <PwaRegister />
        <OfflineDataProvider>
          <OfflineSyncProvider>{children}</OfflineSyncProvider>
        </OfflineDataProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}

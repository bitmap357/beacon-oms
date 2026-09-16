/**
 * Root layout — fonts, theme flash, favicon, toasts.
 *
 * Where to change things
 * ----------------------
 * Data model:           prisma/schema.prisma   (SQL Server; enums are strings)
 * Allowed enum values:  src/lib/db-types.ts
 * Roles / access:       src/lib/permissions.ts
 * Login / JWT:          src/auth.ts
 * Auth gate (cookies):  src/proxy.ts           (Next 16 middleware)
 * API helpers:          src/lib/http.ts
 * Sidebar + header:     src/components/app-shell.tsx
 * Screens:              src/app/(dashboard)/<name>/page.tsx
 * Mutations:            src/app/api/<name>/route.ts
 * Form payloads:        src/lib/validation/index.ts
 * Calendar UI:          src/components/calendar-board.tsx
 * Report layout:        src/lib/reportTemplates/index.ts
 * Nightly jobs:         src/worker.ts
 */
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["500", "600", "700"],
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400"],
});

export const metadata: Metadata = {
  title: {
    default: "Beacon",
    template: "%s · Beacon",
  },
  description: "Spagad Technologies operations management system",
  icons: { icon: "/brand/mark.png", shortcut: "/brand/mark.png", apple: "/brand/mark.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f1e6" },
    { media: "(prefers-color-scheme: dark)", color: "#070b14" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${spaceGrotesk.variable} ${jakarta.variable} ${plexMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('beacon-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-full bg-surface font-sans text-ink">
        {children}
        <Toaster
          position="top-center"
          offset={16}
          mobileOffset={12}
          toastOptions={{
            classNames: {
              toast:
                "border border-hairline bg-surface-raised text-ink shadow-[0_12px_40px_rgba(12,20,36,0.12)]",
              title: "text-ink",
              description: "text-slate",
              success: "border-l-4 border-l-[#1D6B45]",
              error: "border-l-4 border-l-[#791F1F]",
              actionButton: "bg-brand text-white",
              cancelButton: "bg-surface text-ink",
            },
          }}
        />
      </body>
    </html>
  );
}

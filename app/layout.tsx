import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ThemeScript } from "@/components/theme-script";
import "./globals.css";

/**
 * Playfair for headings is not an arbitrary choice: it is the display face the
 * project's own `branding.css` puts on the sign-in widget. Loading it here as
 * well is what stops the auth card from reading as a foreign object dropped
 * into the page.
 */
const display = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-pv-display",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-pv-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-pv-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pontive Next.js demo",
  description:
    "Pontive auth in a Next.js app, proxied under the app's own origin",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // `suppressHydrationWarning` covers exactly one attribute: `data-theme`,
    // which `ThemeScript` writes before React hydrates. It is scoped to this
    // element's own attributes, not its subtree, so nothing else is silenced.
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="pv-body">
        <ThemeScript />
        <Providers>
          <SiteHeader />
          <div className="pv-shell">{children}</div>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}

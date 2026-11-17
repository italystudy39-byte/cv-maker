import type { Metadata, Viewport } from "next";
import { Golos_Text, Source_Serif_4 } from "next/font/google";
import "./globals.css";

// DESIGN 3.3: Golos Text for the interface, Source Serif 4 for headings. Self-hosted by next/font.
const golos = Golos_Text({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600"], variable: "--font-golos", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin", "cyrillic"], weight: ["600"], variable: "--font-source-serif", display: "swap" });

export const metadata: Metadata = {
  title: "Конструктор резюме",
  description: "Резюме, которое удобно читать и на бумаге, и в телефоне. Два PDF: A4 для печати и длинная страница для мессенджеров.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#171b20" },
  ],
};

// Applies the saved theme before first paint, so a dark-theme user never sees a white flash.
const THEME_SCRIPT = `try{var t=localStorage.getItem("ui-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${golos.variable} ${serif.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}

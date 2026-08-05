import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "Stockping — restock alerts for Blinkit, Zepto & Instamart";
const DESCRIPTION =
  "Track any product on Blinkit, Zepto and Instamart at your pincode. Checks every 30 minutes and pings you on Telegram with the price and a direct link the moment it is back in stock.";

// set SITE_URL in .env.local if you ever host this; localhost is fine otherwise
const SITE_URL = process.env.SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s · Stockping" },
  description: DESCRIPTION,
  applicationName: "Stockping",
  keywords: [
    "stock alert",
    "restock alert",
    "out of stock notification",
    "back in stock alert",
    "Blinkit stock checker",
    "Zepto stock checker",
    "Instamart stock checker",
    "Swiggy Instamart availability",
    "quick commerce stock tracker",
    "grocery stock tracker India",
    "Telegram stock alert bot",
    "Telegram restock notification",
    "pincode stock availability",
    "product price tracker India",
    "Hot Wheels restock alert",
    "inventory watcher",
  ],
  authors: [{ name: "Malay Mishra" }],
  creator: "Malay Mishra",
  category: "shopping",
  openGraph: {
    type: "website",
    siteName: "Stockping",
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

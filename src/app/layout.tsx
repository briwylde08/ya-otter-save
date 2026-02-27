import type { Metadata } from "next";
import { Geist_Mono, Fredoka, Titan_One } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const titanOne = Titan_One({
  variable: "--font-titan",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Ya Otter Save",
  description: "MXN to CETES on-ramp with yield earning on Stellar",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${fredoka.variable} ${geistMono.variable} ${titanOne.variable} antialiased font-fredoka`}
      >
        {children}
      </body>
    </html>
  );
}

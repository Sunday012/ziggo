import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { isClerkConfigured } from "@/lib/auth-config";
import "./globals.css";

function getMetadataBase() {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: {
    default: "Ziggo — AI support that feels human",
    template: "%s · Ziggo",
  },
  description:
    "Give every customer thoughtful, on-brand support with an AI agent trained for your business.",
  openGraph: {
    title: "Ziggo — AI support that feels human",
    description: "Resolve more conversations while keeping every response personal.",
    type: "website",
    images: [{ url: "/ziggo-mark.png", width: 1254, height: 1254, alt: "Ziggo" }],
  },
  icons: { icon: "/ziggo-mark.png", apple: "/ziggo-mark.png" },
};

export const viewport: Viewport = {
  themeColor: "#07130f",
  colorScheme: "dark light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const content = isClerkConfigured() ? (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#196b4d",
          colorForeground: "#10251d",
          borderRadius: "0.8rem",
        },
      }}
    >
      {children}
    </ClerkProvider>
  ) : children;

  return (
    <html lang="en">
      <body>{content}</body>
    </html>
  );
}

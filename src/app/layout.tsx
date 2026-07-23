import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SkillCanon",
  description: "Self-hosted prompt registry distributed via MCP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

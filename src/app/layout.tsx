import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EduReport · Terminal Report System for Ghana Basic Schools",
  description:
    "Automated GES-aligned terminal report card system — SBA, exams, attendance, and professional PDF reports for Ghanaian basic schools.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

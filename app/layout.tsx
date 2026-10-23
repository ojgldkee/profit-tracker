import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profit Tracker",
  description: "True ecommerce profit, reconciled from orders, costs, fees and ad spend."
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

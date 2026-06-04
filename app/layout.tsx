import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "虚拟项目运营工作台",
  description: "淘宝/闲鱼虚拟项目执行系统"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

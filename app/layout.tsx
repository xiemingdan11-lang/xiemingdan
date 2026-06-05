import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '选品助手',
  description: '虚拟商品选品记录 & 热点话题分析',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

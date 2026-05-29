import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '心镜',
  description: '基于语言学解构的意识觉察效率工具',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-void text-mirror antialiased">{children}</body>
    </html>
  )
}

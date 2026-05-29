import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '心镜 · MindOS',
  description: '一面在场的镜子',
}

export const viewport: Viewport = {
  themeColor: '#17150f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-[100dvh] text-ink antialiased">{children}</body>
    </html>
  )
}

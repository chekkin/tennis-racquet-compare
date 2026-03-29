import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tennis Racquet Analyser',
  description:
    'Compare tennis racquets side-by-side with animated swing paths, ball trajectory physics, and full specification breakdowns.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  )
}

import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        base: '#1a1028',
        surface: '#251739',
        raised: '#2f2048',
        line: '#3b2a55',
        ink: '#ecd28a',
        'ink-soft': '#e6cf94',
        'ink-dim': '#9a86b0',
        'ink-faint': '#5e4f72',
        gold: '#ffd86a',
        'gold-dim': '#c2a55e',
      },
      fontFamily: {
        sans: ['"PingFang SC"', '"Noto Sans SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        song: ['"Songti SC"', '"STSong"', '"Noto Serif SC"', '"Source Han Serif SC"', 'serif'],
      },
    },
  },
  plugins: [],
}

export default config

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
        base: '#17150f',
        surface: '#1f1c14',
        raised: '#27231a',
        line: '#2e2a20',
        ink: '#ece7da',
        'ink-soft': '#b7b1a2',
        'ink-dim': '#6e695c',
        'ink-faint': '#46423a',
        celadon: '#8fb0a2',
        'celadon-dim': '#5e7167',
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

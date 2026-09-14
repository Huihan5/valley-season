/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#1a1814',
          warm: '#211e19',
          card: '#2a2520',
          hover: '#332e28',
        },
        gold: {
          DEFAULT: '#c4a35a',
          dim: '#8a7440',
          bright: '#e0c06a',
        },
        amber: '#b8784a',
        rust: '#8b4a2a',
        cream: {
          DEFAULT: '#e8dcc8',
          // Section labels and drawer headings. Lifted from #a89878 (2026-09): under
          // the narrow-panel B layout they read as switched-off, "hidden on purpose".
          dim: '#c2b090',
        },
        frost: '#7a9aaa',
        game: {
          text: '#d4c8b0',
          // Microcopy and secondary rows. Lifted twice now — from #8a7e6a, then from
          // #9c8f78 (2026-09) — because at 10–11px on the card it still read as
          // disabled text. Kept a clear step below game-text so the hierarchy holds.
          dim: '#b3a68c',
          bright: '#f0e8d8',
          border: '#3a3530',
          'border-light': '#4a4540',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'serif'],
        sans: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

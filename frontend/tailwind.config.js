/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette approximated from the IDSM Figma exports. Tune here.
        brand: {
          DEFAULT: '#4F46E5', // primary indigo — buttons, links, active accents
          soft: '#7C7DE8', // lighter periwinkle — login CTA
          heading: '#2E3A8C', // "WELCOME" royal blue
          blob: '#3A36DD', // auth illustration blob
        },
        ink: {
          DEFAULT: '#18181B', // primary text / dark buttons
          muted: '#71717A', // secondary text
          faint: '#A1A1AA', // placeholder / disabled
        },
        surface: {
          DEFAULT: '#FFFFFF',
          app: '#F5F5F4', // app content background
          auth: '#EEEFF2', // auth screen background
          sunken: '#F4F4F5', // active nav pill / table header
        },
        line: '#E4E4E7', // borders / dividers
        card: {
          blue: '#E9F2FD',
          green: '#E9F7EF',
          purple: '#F1EAFB',
          orange: '#FBEEDD',
        },
        status: {
          okFg: '#15803D',
          okBg: '#E9F7EF',
          warnFg: '#92600A',
          warnBg: '#FCE8A6',
          dangerFg: '#B91C1C',
          dangerBg: '#FBDCE0',
          neutralFg: '#52525B',
          neutralBg: '#F1F1F2',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'sans-serif'],
        display: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(24, 24, 27, 0.04), 0 8px 24px rgba(24, 24, 27, 0.06)',
      },
    },
  },
  plugins: [],
};

import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        'signal-yes': {
          DEFAULT: 'hsl(var(--signal-yes))',
          light: 'hsl(160 84% 39% / 0.1)',
          medium: 'hsl(160 84% 39% / 0.2)',
        },
        'signal-no': {
          DEFAULT: 'hsl(var(--signal-no))',
          light: 'hsl(258 90% 66% / 0.1)',
          medium: 'hsl(258 90% 66% / 0.2)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        'glass': '0 4px 30px rgba(0, 0, 0, 0.04)',
        'glass-lg': '0 8px 40px rgba(0, 0, 0, 0.06)',
        'glow-yes': '0 0 20px hsl(160 84% 39% / 0.15)',
        'glow-no': '0 0 20px hsl(258 90% 66% / 0.15)',
      },
      animation: {
        'shimmer': 'shimmer-slide 1.5s ease-in-out infinite',
        'fade-up': 'fade-up 0.45s ease-out both',
        'scale-in': 'scale-in 0.35s ease-out both',
        'bounce-up': 'bounce-up 0.6s cubic-bezier(0.34,1.56,0.64,1) both',
        'bar-grow': 'bar-grow 0.7s cubic-bezier(0.34,1.56,0.64,1) both',
        'bar-width': 'width-grow 0.7s cubic-bezier(0.33,1,0.68,1) both',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // VR-optimized color palette
        vr: {
          primary: '#00ff41',      // Matrix green for primary actions
          secondary: '#00ccff',    // Cyan for secondary actions
          danger: '#ff3333',       // Red for danger/cancel
          warning: '#ffaa00',      // Orange for warnings
          success: '#00ff88',      // Bright green for success
          background: '#000000',   // Deep black background
          surface: '#111111',      // Dark surface
          'surface-light': '#222222', // Lighter surface
          text: '#ffffff',         // White text
          'text-dim': '#aaaaaa',   // Dimmed text
          border: '#333333',       // Border color
        }
      },
      fontSize: {
        // VR-optimized font sizes
        'vr-xs': '1rem',    // 16px
        'vr-sm': '1.25rem', // 20px
        'vr-base': '1.5rem', // 24px
        'vr-lg': '1.875rem', // 30px
        'vr-xl': '2.25rem',  // 36px
        'vr-2xl': '3rem',    // 48px
        'vr-3xl': '3.75rem', // 60px
      },
      spacing: {
        // VR-friendly spacing
        'vr-1': '0.5rem',   // 8px
        'vr-2': '0.75rem',  // 12px
        'vr-3': '1rem',     // 16px
        'vr-4': '1.5rem',   // 24px
        'vr-5': '2rem',     // 32px
        'vr-6': '2.5rem',   // 40px
        'vr-8': '3rem',     // 48px
        'vr-10': '4rem',    // 64px
      },
      borderWidth: {
        'vr': '3px',  // VR-visible borders
      },
      borderRadius: {
        'vr': '12px', // VR-friendly rounded corners
        'vr-lg': '20px',
      }
    },
  },
  plugins: [],
}
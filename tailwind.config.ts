import type { Config } from "tailwindcss";

export default {
	darkMode: "class",
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	// Enable better purging for performance
	safelist: [
		// Keep essential dynamic classes
		'bg-primary',
		'text-primary-foreground',
		'bg-muted',
		'text-foreground',
		'animate-pulse',
		'opacity-0',
		'opacity-100',
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			height: {
				'screen-dynamic': '100dvh',
				'screen-small': '100svh', 
				'screen-large': '100lvh',
			},
			minHeight: {
				'screen-dynamic': '100dvh',
				'screen-small': '100svh',
				'screen-large': '100lvh',
			},
			fontFamily: {
				sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', 'sans-serif'],
				arcade: ['Orbitron', 'monospace'],
				orbitron: ['Orbitron', 'monospace'],
				chat: ['Exo 2', 'Inter', 'sans-serif'],
				exo2: ['Exo 2', 'Inter', 'sans-serif'],
				pixel: ['Press Start 2P', 'monospace'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				
				// Glassmorphism colors
				'glass-bg': 'hsla(var(--glass-bg))',
				'glass-border': 'hsla(var(--glass-border))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				huddle: {
					primary: 'hsl(var(--huddle-primary))',
					secondary: 'hsl(var(--huddle-secondary))'
				},
				verified: {
					primary: 'hsl(var(--verified-primary))',
					background: 'hsl(var(--verified-background))',
					border: 'hsl(var(--verified-border))'
				},
				spotlight: 'hsl(var(--spotlight))',
				'like-button': 'hsl(var(--like-button))',
				'fire-button': 'hsl(var(--fire-button))',
				
				// Bot colors
				'bot-bubble': 'hsla(var(--bot-bubble))',
				'bot-border': 'hsla(var(--bot-border))',
				
				// Retro Arcade Colors
				'team-primary': 'hsl(var(--team-primary))',
				'team-secondary': 'hsl(var(--team-secondary))',
				'team-accent': 'hsl(var(--team-accent))',
				'neon-glow': 'hsl(var(--neon-glow))',
				'scanline': 'hsla(var(--scanline))',
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0', opacity: '0' },
					to: { height: 'var(--radix-accordion-content-height)', opacity: '1' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)', opacity: '1' },
					to: { height: '0', opacity: '0' }
				},
				'fade-in': {
					'0%': { opacity: '0', transform: 'translateY(10px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				'fade-out': {
					'0%': { opacity: '1', transform: 'translateY(0)' },
					'100%': { opacity: '0', transform: 'translateY(10px)' }
				},
				'scale-in': {
					'0%': { transform: 'scale(0.95)', opacity: '0' },
					'100%': { transform: 'scale(1)', opacity: '1' }
				},
				'scale-out': {
					from: { transform: 'scale(1)', opacity: '1' },
					to: { transform: 'scale(0.95)', opacity: '0' }
				},
				'slide-in-right': {
					'0%': { transform: 'translateX(100%)' },
					'100%': { transform: 'translateX(0)' }
				},
				'slide-out-right': {
					'0%': { transform: 'translateX(0)' },
					'100%': { transform: 'translateX(100%)' }
				},
				'pulse-glow': {
					'0%, 100%': { boxShadow: '0 0 0 0 rgba(255, 193, 7, 0.4)' },
					'50%': { boxShadow: '0 0 0 8px rgba(255, 193, 7, 0.1)' }
				},
				'float': {
					'0%, 100%': { transform: 'translateY(0px)' },
					'50%': { transform: 'translateY(-4px)' }
				},
				'shimmer': {
					'0%': { backgroundPosition: '-200% 0' },
					'100%': { backgroundPosition: '200% 0' }
				},
				'slide-up': {
					'0%': { transform: 'translateY(10px)', opacity: '0' },
					'100%': { transform: 'translateY(0)', opacity: '1' }
				},
				'message-bounce': {
					'0%, 20%, 53%, 80%, 100%': { transform: 'translate3d(0, 0, 0)' },
					'40%, 43%': { transform: 'translate3d(0, -4px, 0)' },
					'70%': { transform: 'translate3d(0, -2px, 0)' },
					'90%': { transform: 'translate3d(0, -1px, 0)' }
				},
				'neon-pulse': {
					'0%, 100%': { 
						textShadow: '0 0 5px currentColor, 0 0 10px currentColor, 0 0 15px currentColor',
						opacity: '1'
					},
					'50%': { 
						textShadow: '0 0 2px currentColor, 0 0 5px currentColor, 0 0 8px currentColor',
						opacity: '0.8'
					}
				},
				'crt-flicker': {
					'0%, 100%': { opacity: '1' },
					'98%': { opacity: '1' },
					'99%': { opacity: '0.98' },
					'99.5%': { opacity: '1' }
				},
				'retro-tilt': {
					'0%': { transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)' },
					'100%': { transform: 'perspective(1000px) rotateX(2deg) rotateY(-1deg)' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.3s ease-out',
				'accordion-up': 'accordion-up 0.3s ease-out',
				'fade-in': 'fade-in 0.3s ease-out',
				'fade-out': 'fade-out 0.3s ease-out',
				'scale-in': 'scale-in 0.2s ease-out',
				'scale-out': 'scale-out 0.2s ease-out',
				'slide-in-right': 'slide-in-right 0.3s ease-out',
				'slide-out-right': 'slide-out-right 0.3s ease-out',
				'pulse-glow': 'pulse-glow 2s infinite',
				'float': 'float 3s ease-in-out infinite',
				'shimmer': 'shimmer 2s linear infinite',
				'slide-up': 'slide-up 0.2s ease-out',
				'message-bounce': 'message-bounce 0.6s ease-out',
				'enter': 'fade-in 0.3s ease-out, scale-in 0.2s ease-out',
				'exit': 'fade-out 0.3s ease-out, scale-out 0.2s ease-out',
				'neon-pulse': 'neon-pulse 2s ease-in-out infinite',
				'crt-flicker': 'crt-flicker 0.15s linear infinite',
				'retro-tilt': 'retro-tilt 0.3s ease-out forwards'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;

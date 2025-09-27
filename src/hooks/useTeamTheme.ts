import { useState, useEffect } from 'react';

interface TeamTheme {
  primary: string;
  secondary: string;
  accent: string;
  name: string;
  mascot: string;
  logo?: string;
}

const TEAM_THEMES: Record<string, TeamTheme> = {
  // NFL Teams
  'bills': {
    primary: '217 100% 28%', // Royal Blue
    secondary: '349 87% 39%', // Bills Red
    accent: '45 100% 51%', // Yellow
    name: 'Bills Mafia',
    mascot: '🐃',
    logo: '/src/assets/sh-logo-updated.png'
  },
  'steelers': {
    primary: '45 100% 50%', // Gold
    secondary: '0 0% 15%', // Black
    accent: '0 0% 85%', // Silver
    name: 'Steeler Nation',
    mascot: '⚡',
    logo: '/src/assets/sh-logo-updated.png'
  },
  'packers': {
    primary: '84 64% 40%', // Green
    secondary: '45 100% 50%', // Gold
    accent: '0 0% 95%', // White
    name: 'Cheeseheads',
    mascot: '🧀',
    logo: '/src/assets/sh-logo-updated.png'
  },
  'cowboys': {
    primary: '210 100% 45%', // Navy
    secondary: '0 0% 75%', // Silver
    accent: '0 0% 100%', // White
    name: "America's Team",
    mascot: '⭐',
    logo: '/src/assets/sh-logo-updated.png'
  },
  'patriots': {
    primary: '217 100% 28%', // Navy
    secondary: '349 87% 50%', // Red
    accent: '0 0% 85%', // Silver
    name: 'Patriots Nation',
    mascot: '🦅',
    logo: '/src/assets/sh-logo-updated.png'
  },
  // Default fallback
  'default': {
    primary: '217 100% 28%',
    secondary: '349 87% 39%',
    accent: '45 100% 51%',
    name: 'Sports Huddle',
    mascot: '🏈',
    logo: '/src/assets/sh-logo-updated.png'
  }
};

export const useTeamTheme = (teamName?: string) => {
  const [theme, setTheme] = useState<TeamTheme>(TEAM_THEMES.default);

  useEffect(() => {
    if (!teamName) return;
    
    // AI-powered team detection (simplified for now)
    const detectTeam = (name: string): TeamTheme => {
      const normalized = name.toLowerCase();
      
      if (normalized.includes('bill') || normalized.includes('buffalo')) return TEAM_THEMES.bills;
      if (normalized.includes('steel') || normalized.includes('pittsburgh')) return TEAM_THEMES.steelers;
      if (normalized.includes('pack') || normalized.includes('green bay')) return TEAM_THEMES.packers;
      if (normalized.includes('cowboy') || normalized.includes('dallas')) return TEAM_THEMES.cowboys;
      if (normalized.includes('patriot') || normalized.includes('new england')) return TEAM_THEMES.patriots;
      
      return TEAM_THEMES.default;
    };

    const detectedTheme = detectTeam(teamName);
    setTheme(detectedTheme);

    // Apply CSS custom properties for dynamic theming
    const root = document.documentElement;
    root.style.setProperty('--team-primary', detectedTheme.primary);
    root.style.setProperty('--team-secondary', detectedTheme.secondary);
    root.style.setProperty('--team-accent', detectedTheme.accent);
    
  }, [teamName]);

  return theme;
};
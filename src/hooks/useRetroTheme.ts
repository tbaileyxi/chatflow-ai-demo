import { useState, useEffect } from 'react';

interface RetroTheme {
  primary: string;
  secondary: string;
  accent: string;
  neonGlow: string;
  name: string;
  mascot: string;
  pattern: string;
}

const RETRO_TEAM_THEMES: Record<string, RetroTheme> = {
  'buffaloes': {
    primary: '0 0% 15%', // Deep Black
    secondary: '45 100% 50%', // Pure Gold
    accent: '0 0% 85%', // Light Silver
    neonGlow: '45 100% 60%', // Bright Gold Glow
    name: 'Colorado Buffs',
    mascot: '🦬',
    pattern: 'mountain-peaks'
  },
  'bills': {
    primary: '217 100% 55%', // Electric Royal Blue
    secondary: '349 87% 50%', // Fiery Red
    accent: '45 100% 60%', // Bright Yellow
    neonGlow: '217 100% 70%', // Neon Blue
    name: 'Bills Mafia',
    mascot: '🐃',
    pattern: 'snow-storm'
  },
  'steelers': {
    primary: '45 100% 55%', // Electric Gold
    secondary: '0 0% 10%', // Deep Black
    accent: '0 0% 80%', // Bright Silver
    neonGlow: '45 100% 70%', // Neon Gold
    name: 'Steeler Nation',
    mascot: '⚡',
    pattern: 'steel-grid'
  },
  'packers': {
    primary: '84 70% 45%', // Forest Green
    secondary: '45 100% 55%', // Electric Gold
    accent: '0 0% 95%', // Clean White
    neonGlow: '84 70% 60%', // Neon Green
    name: 'Cheeseheads',
    mascot: '🧀',
    pattern: 'cheese-holes'
  },
  'cowboys': {
    primary: '210 100% 50%', // Electric Navy
    secondary: '0 0% 70%', // Bright Silver
    accent: '0 0% 100%', // Pure White
    neonGlow: '210 100% 70%', // Neon Blue
    name: "America's Team",
    mascot: '⭐',
    pattern: 'star-field'
  },
  'patriots': {
    primary: '217 100% 50%', // Electric Navy
    secondary: '349 87% 55%', // Bright Red
    accent: '0 0% 85%', // Silver
    neonGlow: '217 100% 70%', // Neon Blue
    name: 'Patriots Nation',
    mascot: '🦅',
    pattern: 'liberty-lines'
  },
  'default': {
    primary: '217 100% 55%',
    secondary: '349 87% 50%',
    accent: '45 100% 60%',
    neonGlow: '217 100% 70%',
    name: 'Sports Huddle',
    mascot: '🏈',
    pattern: 'retro-grid'
  }
};

export const useRetroTheme = (teamName?: string) => {
  const [theme, setTheme] = useState<RetroTheme>(RETRO_TEAM_THEMES.default);

  useEffect(() => {
    if (!teamName) return;
    
    const detectTeam = (name: string): RetroTheme => {
      const normalized = name.toLowerCase();
      
      if (normalized.includes('buffalo') && (normalized.includes('bill') || normalized.includes('bills'))) return RETRO_TEAM_THEMES.bills;
      if (normalized.includes('colorado') || normalized.includes('buff')) return RETRO_TEAM_THEMES.buffaloes;
      if (normalized.includes('steel') || normalized.includes('pittsburgh')) return RETRO_TEAM_THEMES.steelers;
      if (normalized.includes('pack') || normalized.includes('green bay')) return RETRO_TEAM_THEMES.packers;
      if (normalized.includes('cowboy') || normalized.includes('dallas')) return RETRO_TEAM_THEMES.cowboys;
      if (normalized.includes('patriot') || normalized.includes('new england')) return RETRO_TEAM_THEMES.patriots;
      
      return RETRO_TEAM_THEMES.default;
    };

    const detectedTheme = detectTeam(teamName);
    setTheme(detectedTheme);

    // Apply retro CSS custom properties
    const root = document.documentElement;
    root.style.setProperty('--team-primary', detectedTheme.primary);
    root.style.setProperty('--team-secondary', detectedTheme.secondary);
    root.style.setProperty('--team-accent', detectedTheme.accent);
    root.style.setProperty('--neon-glow', detectedTheme.neonGlow);
    
  }, [teamName]);

  return theme;
};
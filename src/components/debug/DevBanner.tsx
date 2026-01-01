import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function DevBanner() {
  const location = useLocation();
  const { user } = useAuth();

  // Determine environment
  const isDev = window.location.hostname.includes('localhost') || 
                window.location.hostname.includes('lovableproject.com');

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-destructive text-destructive-foreground text-[10px] px-2 py-0.5 font-mono flex gap-4 items-center">
      <span>DEV: ROUTE={location.pathname}</span>
      <span>user={user?.id?.slice(0, 8) || 'anon'}</span>
      <span>env={isDev ? 'dev' : 'prod'}</span>
    </div>
  );
}

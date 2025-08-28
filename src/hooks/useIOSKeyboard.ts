import { useEffect, useState, useCallback } from 'react';

interface IOSKeyboardState {
  isOpen: boolean;
  height: number;
  viewportHeight: number;
}

export const useIOSKeyboard = () => {
  const [keyboardState, setKeyboardState] = useState<IOSKeyboardState>({
    isOpen: false,
    height: 0,
    viewportHeight: window.innerHeight
  });

  const [isTyping, setIsTyping] = useState(false);

  const handleResize = useCallback(() => {
    const currentHeight = window.innerHeight;
    const initialHeight = keyboardState.viewportHeight;
    
    // Detect keyboard on iOS by significant height reduction
    const heightDiff = initialHeight - currentHeight;
    const isKeyboardOpen = heightDiff > 150; // iOS keyboard is usually 200-300px
    
    setKeyboardState(prev => ({
      ...prev,
      isOpen: isKeyboardOpen,
      height: isKeyboardOpen ? heightDiff : 0
    }));
  }, [keyboardState.viewportHeight]);

  const setTypingState = useCallback((typing: boolean) => {
    setIsTyping(typing);
  }, []);

  useEffect(() => {
    // Store initial viewport height
    setKeyboardState(prev => ({
      ...prev,
      viewportHeight: window.innerHeight
    }));

    const handleVisualViewport = () => {
      if (window.visualViewport) {
        const currentHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        const heightDiff = windowHeight - currentHeight;
        
        setKeyboardState(prev => ({
          ...prev,
          isOpen: heightDiff > 150,
          height: heightDiff > 150 ? heightDiff : 0
        }));
      }
    };

    // Use visual viewport API if available (iOS Safari)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewport);
    } else {
      window.addEventListener('resize', handleResize);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewport);
      } else {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, [handleResize]);

  return {
    ...keyboardState,
    isTyping,
    setTypingState
  };
};
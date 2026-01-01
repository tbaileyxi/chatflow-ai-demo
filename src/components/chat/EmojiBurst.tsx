import React from 'react';
import { motion } from 'framer-motion';

interface EmojiBurstProps {
  emoji: string;
  x: number;
  y: number;
  onComplete?: () => void;
}

export const EmojiBurst: React.FC<EmojiBurstProps> = ({ emoji, x, y, onComplete }) => {
  return (
    <motion.div
      initial={{ x, y, scale: 0.5, opacity: 1 }}
      animate={{ 
        y: y - 120, 
        scale: 1.5, 
        opacity: 0 
      }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      onAnimationComplete={onComplete}
      className="fixed pointer-events-none text-3xl z-50"
      style={{ transform: 'translate(-50%, -50%)' }}
    >
      {emoji}
    </motion.div>
  );
};

EmojiBurst.displayName = 'EmojiBurst';

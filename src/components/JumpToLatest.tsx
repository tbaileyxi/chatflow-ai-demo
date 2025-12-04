import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChevronUp } from 'lucide-react';

interface JumpToLatestProps {
  visible: boolean;
  onClick: () => void;
}

export const JumpToLatest: React.FC<JumpToLatestProps> = ({ visible, onClick }) => {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed top-24 left-1/2 -translate-x-1/2 z-50"
        >
          <Button
            onClick={onClick}
            className="bg-yellow-400 text-black rounded-full shadow-lg px-4 py-2 hover:bg-yellow-500 transition-colors touch-manipulation min-h-[44px] font-semibold"
            size="sm"
          >
            <ChevronUp className="h-4 w-4 mr-1" />
            <span>New Messages</span>
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
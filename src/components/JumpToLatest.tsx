import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';

interface JumpToLatestProps {
  visible: boolean;
  onClick: () => void;
}

export const JumpToLatest: React.FC<JumpToLatestProps> = ({ visible, onClick }) => {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed bottom-20 right-4 z-50"
        >
          <Button
            onClick={onClick}
            className="bg-primary text-white rounded-full shadow-lg px-4 py-2 hover:bg-primary/90 transition-colors"
            size="sm"
          >
            <ChevronDown className="h-4 w-4 mr-1" />
            Jump to latest
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
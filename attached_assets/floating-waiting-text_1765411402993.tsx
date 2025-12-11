import React, { memo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface FloatingWaitingTextProps {
  /** Additional CSS classes to apply to the container */
  className?: string;
  /** Aria label for accessibility */
  'aria-label'?: string;
}

interface TypewriterTextProps {
  text: string;
  speed?: number;
  className?: string;
  onComplete?: () => void;
}

/**
 * TypewriterText Component
 * 
 * Creates a realistic typewriter effect with character-by-character reveal
 */
const TypewriterText = memo<TypewriterTextProps>(function TypewriterText({ 
  text, 
  speed = 120, 
  className,
  onComplete 
}) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, speed);

      return () => clearTimeout(timer);
    } else if (onComplete) {
      onComplete();
    }
  }, [currentIndex, text, speed, onComplete]);

  // Reset when text changes
  useEffect(() => {
    setDisplayedText('');
    setCurrentIndex(0);
  }, [text]);

  return (
    <span className={className}>
      {displayedText}
      {currentIndex < text.length && (
        <span className="typewriter-cursor">|</span>
      )}
    </span>
  );
});

/**
 * FloatingWaitingText Component
 * 
 * Displays professional typewriter-style waiting text with realistic
 * character-by-character animation and vintage typewriter aesthetic
 */
const FloatingWaitingText = memo<FloatingWaitingTextProps>(function FloatingWaitingText({ 
  className,
  'aria-label': ariaLabel = 'Waiting for response'
}) {
  const [showSubtext, setShowSubtext] = useState(false);

  return (
    <div 
      className={cn(
        "absolute inset-x-0 bottom-20 flex items-end justify-center pointer-events-none z-10 pb-8",
        className
      )}
      role="status"
      aria-label={ariaLabel}
      aria-live="polite"
    >
      {/* Typewriter waiting text */}
      <div className="text-center max-w-3xl px-4">
        <div className="typewriter-container">
          <h2 className="typewriter-text typewriter-main">
            <TypewriterText 
              text="Their turn to write"
              speed={100}
              onComplete={() => setShowSubtext(true)}
            />
          </h2>
          
          {showSubtext && (
            <p className="typewriter-text typewriter-sub">
              <TypewriterText 
                text="Waiting for their thoughtful response..."
                speed={80}
              />
            </p>
          )}
        </div>
      </div>

      {/* Screen reader only text for accessibility */}
      <span className="sr-only">
        Waiting for the other person to respond to the conversation
      </span>
    </div>
  );
});

export default FloatingWaitingText;
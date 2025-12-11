interface QuotesIconProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export default function QuotesIcon({ className = "", size = 'md' }: QuotesIconProps) {
  const sizeClasses = {
    xs: 'h-3 w-auto', // Extra small for inline text elements
    sm: 'h-4 w-auto', // Small size for badges and compact areas
    md: 'h-5 w-auto', // Medium size for general use
    lg: 'h-6 w-auto', // Large size for emphasis
    xl: 'h-8 w-auto', // Extra large for hero sections
  };

  return (
    <img 
      src="/quotes-icon.png" 
      alt="Deeper quotes" 
      className={`${sizeClasses[size]} object-contain select-none ${className}`}
      loading="eager"
      decoding="async"
      onError={(e) => {
        console.error('Quotes icon failed to load:', e);
        // Production-ready fallback with quotation marks
        const img = e.target as HTMLImageElement;
        img.style.display = 'none';
        
        // Create text fallback for production reliability
        const fallback = document.createElement('span');
        fallback.textContent = '""';
        fallback.className = `${sizeClasses[size]} font-bold text-ocean ${className}`;
        img.parentNode?.insertBefore(fallback, img);
      }}
    />
  );
}
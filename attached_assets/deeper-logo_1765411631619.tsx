interface DeeperLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'header';
}

export default function DeeperLogo({ className = "", size = 'md' }: DeeperLogoProps) {
  const sizeClasses = {
    xs: 'h-4 w-auto', // Extra small for badges and compact UI elements
    sm: 'h-5 w-auto', // Small size for popups and compact areas
    md: 'h-8 w-auto', // Medium size for dashboard headers
    lg: 'h-10 w-auto', // Large size for auth pages and navigation headers
    xl: 'h-16 w-auto', // Extra large for hero sections
    header: 'h-12 w-auto', // Maximizes header space (h-12 = 48px) with small padding
  };

  return (
    <img 
      src="/deeper-logo.png" 
      alt="Deeper" 
      className={`${sizeClasses[size]} object-contain select-none ${className}`}
      loading="eager"
      decoding="async"
      onError={(e) => {
        console.error('Logo failed to load:', e);
        // Production-ready fallback with proper error handling
        const img = e.target as HTMLImageElement;
        img.style.display = 'none';
        
        // Create text fallback for production reliability
        const fallback = document.createElement('span');
        fallback.textContent = 'Deeper';
        fallback.className = `${sizeClasses[size]} font-bold text-ocean ${className}`;
        img.parentNode?.insertBefore(fallback, img);
      }}
    />
  );
}
import { useEffect, useRef } from 'react';

interface HypnoticOrbsProps {
  className?: string;
}

export function HypnoticOrbs({ className = "" }: HypnoticOrbsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Enhanced orb configuration - highly visible throughout 20-30 minute cycle
    const orbs = [
      {
        x: 0.2 + Math.random() * 0.1,
        y: 0.3 + Math.random() * 0.1,
        baseRadius: 35, // Start highly visible
        maxRadius: 80,
        growthDuration: 15 * 60 * 1000, // 15 minutes
        color: { r: 79, g: 172, b: 254 }, // Ocean blue
        alpha: 0.35, // Significantly increased visibility
        pulseSpeed: 0.002 + Math.random() * 0.003,
        driftSpeed: 0.0002 + Math.random() * 0.0003,
        spiralRadius: 0.04 + Math.random() * 0.06,
        chaosX: Math.random() * 0.5,
        chaosY: Math.random() * 0.5,
        wobbleSpeed: 0.001 + Math.random() * 0.002
      },
      {
        x: 0.6 + Math.random() * 0.15,
        y: 0.5 + Math.random() * 0.15,
        baseRadius: 30, // Start highly visible
        maxRadius: 65,
        growthDuration: 12 * 60 * 1000, // 12 minutes
        color: { r: 215, g: 160, b: 135 }, // Warm amber
        alpha: 0.32, // Significantly increased visibility
        pulseSpeed: 0.0025 + Math.random() * 0.004,
        driftSpeed: 0.00025 + Math.random() * 0.0004,
        spiralRadius: 0.05 + Math.random() * 0.07,
        chaosX: Math.random() * 0.6,
        chaosY: Math.random() * 0.6,
        wobbleSpeed: 0.0015 + Math.random() * 0.0025
      },
      {
        x: 0.4 + Math.random() * 0.2,
        y: 0.2 + Math.random() * 0.2,
        baseRadius: 40, // Start highly visible
        maxRadius: 95,
        growthDuration: 18 * 60 * 1000, // 18 minutes
        color: { r: 120, g: 200, b: 180 }, // Soft teal
        alpha: 0.28, // Significantly increased visibility
        pulseSpeed: 0.0015 + Math.random() * 0.0025,
        driftSpeed: 0.0003 + Math.random() * 0.0005,
        spiralRadius: 0.03 + Math.random() * 0.05,
        chaosX: Math.random() * 0.4,
        chaosY: Math.random() * 0.4,
        wobbleSpeed: 0.0008 + Math.random() * 0.0015
      },
      {
        x: 0.1 + Math.random() * 0.1,
        y: 0.6 + Math.random() * 0.2,
        baseRadius: 26, // Start highly visible
        maxRadius: 55,
        growthDuration: 10 * 60 * 1000, // 10 minutes
        color: { r: 160, g: 140, b: 220 }, // Soft purple
        alpha: 0.30, // Significantly increased visibility
        pulseSpeed: 0.003 + Math.random() * 0.005,
        driftSpeed: 0.0004 + Math.random() * 0.0006,
        spiralRadius: 0.06 + Math.random() * 0.08,
        chaosX: Math.random() * 0.7,
        chaosY: Math.random() * 0.7,
        wobbleSpeed: 0.002 + Math.random() * 0.003
      },
      {
        x: 0.75 + Math.random() * 0.15,
        y: 0.15 + Math.random() * 0.15,
        baseRadius: 32, // Start highly visible
        maxRadius: 75,
        growthDuration: 14 * 60 * 1000, // 14 minutes
        color: { r: 255, g: 180, b: 150 }, // Warm peach
        alpha: 0.29, // Significantly increased visibility
        pulseSpeed: 0.0018 + Math.random() * 0.003,
        driftSpeed: 0.00035 + Math.random() * 0.0005,
        spiralRadius: 0.045 + Math.random() * 0.065,
        chaosX: Math.random() * 0.5,
        chaosY: Math.random() * 0.5,
        wobbleSpeed: 0.0012 + Math.random() * 0.002
      },
      // Additional orbs for more visual complexity
      {
        x: 0.5 + Math.random() * 0.3,
        y: 0.7 + Math.random() * 0.2,
        baseRadius: 28, // Start highly visible
        maxRadius: 60,
        growthDuration: 8 * 60 * 1000, // 8 minutes
        color: { r: 147, g: 197, b: 253 }, // Light blue
        alpha: 0.31, // Significantly increased visibility
        pulseSpeed: 0.004 + Math.random() * 0.006,
        driftSpeed: 0.0005 + Math.random() * 0.0008,
        spiralRadius: 0.07 + Math.random() * 0.09,
        chaosX: Math.random() * 0.8,
        chaosY: Math.random() * 0.8,
        wobbleSpeed: 0.0025 + Math.random() * 0.004
      },
      {
        x: 0.85 + Math.random() * 0.1,
        y: 0.45 + Math.random() * 0.25,
        baseRadius: 34, // Start highly visible
        maxRadius: 70,
        growthDuration: 16 * 60 * 1000, // 16 minutes
        color: { r: 255, g: 205, b: 86 }, // Golden yellow
        alpha: 0.27, // Significantly increased visibility
        pulseSpeed: 0.0022 + Math.random() * 0.0035,
        driftSpeed: 0.00028 + Math.random() * 0.0004,
        spiralRadius: 0.038 + Math.random() * 0.055,
        chaosX: Math.random() * 0.6,
        chaosY: Math.random() * 0.6,
        wobbleSpeed: 0.0016 + Math.random() * 0.0025
      },
      {
        x: 0.3 + Math.random() * 0.4,
        y: 0.8 + Math.random() * 0.15,
        baseRadius: 24, // Start highly visible
        maxRadius: 50,
        growthDuration: 6 * 60 * 1000, // 6 minutes
        color: { r: 198, g: 167, b: 254 }, // Lavender
        alpha: 0.33, // Significantly increased visibility
        pulseSpeed: 0.005 + Math.random() * 0.008,
        driftSpeed: 0.0006 + Math.random() * 0.001,
        spiralRadius: 0.08 + Math.random() * 0.1,
        chaosX: Math.random(),
        chaosY: Math.random(),
        wobbleSpeed: 0.003 + Math.random() * 0.005
      }
    ];

    const animate = () => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTimeRef.current;
      
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Clear canvas completely - no background overlay
      ctx.clearRect(0, 0, width, height);

      orbs.forEach((orb, index) => {
        // Calculate growth progress (0 to 1 over growth duration)
        const growthProgress = Math.min(elapsed / orb.growthDuration, 1);
        
        // Smooth growth curve (ease-out)
        const smoothGrowth = 1 - Math.pow(1 - growthProgress, 3);
        
        // Calculate current radius with enhanced pulsing for visibility
        const pulseOffset = Math.sin(elapsed * orb.pulseSpeed) * 0.25; // Increased pulse intensity
        const currentRadius = orb.baseRadius + (orb.maxRadius - orb.baseRadius) * smoothGrowth * (1 + pulseOffset);
        
        // Calculate position with faster, more chaotic movement patterns
        const driftAngle = elapsed * orb.driftSpeed;
        const wobbleAngle = elapsed * orb.wobbleSpeed;
        
        // Primary spiral movement
        const spiralX = Math.cos(driftAngle) * orb.spiralRadius * smoothGrowth;
        const spiralY = Math.sin(driftAngle * 0.7) * orb.spiralRadius * smoothGrowth;
        
        // Secondary wobble/chaos movement
        const chaosX = Math.sin(wobbleAngle * 2.3) * orb.chaosX * 0.1 * smoothGrowth;
        const chaosY = Math.cos(wobbleAngle * 1.7) * orb.chaosY * 0.1 * smoothGrowth;
        
        // Tertiary figure-8 pattern for more complexity
        const figure8X = Math.sin(wobbleAngle * 0.5) * 0.03 * smoothGrowth;
        const figure8Y = Math.sin(wobbleAngle) * 0.02 * smoothGrowth;
        
        const x = (orb.x + spiralX + chaosX + figure8X) * width;
        const y = (orb.y + spiralY + chaosY + figure8Y) * height;
        
        // Create radial gradient for each orb
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, currentRadius);
        
        // Enhanced gradient with higher visibility throughout
        gradient.addColorStop(0, `rgba(${orb.color.r}, ${orb.color.g}, ${orb.color.b}, ${orb.alpha * 1.0})`); // Bright center
        gradient.addColorStop(0.2, `rgba(${orb.color.r}, ${orb.color.g}, ${orb.color.b}, ${orb.alpha * 0.7})`); // Strong inner glow
        gradient.addColorStop(0.5, `rgba(${orb.color.r}, ${orb.color.g}, ${orb.color.b}, ${orb.alpha * 0.4})`); // Mid-range visibility
        gradient.addColorStop(0.8, `rgba(${orb.color.r}, ${orb.color.g}, ${orb.color.b}, ${orb.alpha * 0.15})`); // Extended glow
        gradient.addColorStop(1, `rgba(${orb.color.r}, ${orb.color.g}, ${orb.color.b}, 0)`); // Soft edge
        
        // Draw the orb
        ctx.beginPath();
        ctx.arc(x, y, currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Enhanced ring effects for increased visibility
        if (smoothGrowth > 0.2) {
          // Multiple concentric rings for depth
          const rings = [
            { radius: currentRadius * 0.9, opacity: (smoothGrowth - 0.2) * 0.25, width: 1.5 },
            { radius: currentRadius * 0.7, opacity: (smoothGrowth - 0.2) * 0.18, width: 1 },
            { radius: currentRadius * 0.5, opacity: (smoothGrowth - 0.2) * 0.12, width: 0.8 }
          ];
          
          rings.forEach(ring => {
            ctx.beginPath();
            ctx.arc(x, y, ring.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${orb.color.r}, ${orb.color.g}, ${orb.color.b}, ${ring.opacity})`;
            ctx.lineWidth = ring.width;
            ctx.stroke();
          });
        }
      });

      // Enhanced dynamic connecting lines with higher visibility
      if (elapsed > 1 * 60 * 1000) { // After 1 minute (faster activation)
        const connectionOpacity = Math.min((elapsed - 1 * 60 * 1000) / (3 * 60 * 1000), 0.15); // Increased max opacity
        const pulseConnection = Math.sin(elapsed * 0.001) * 0.05 + 0.08; // Stronger pulsing
        
        for (let i = 0; i < orbs.length; i++) {
          for (let j = i + 1; j < orbs.length; j++) {
            const orb1 = orbs[i];
            const orb2 = orbs[j];
            
            // Calculate current positions including movement
            const driftAngle1 = elapsed * orb1.driftSpeed;
            const wobbleAngle1 = elapsed * orb1.wobbleSpeed;
            const spiralX1 = Math.cos(driftAngle1) * orb1.spiralRadius * (elapsed / orb1.growthDuration);
            const spiralY1 = Math.sin(driftAngle1 * 0.7) * orb1.spiralRadius * (elapsed / orb1.growthDuration);
            const chaosX1 = Math.sin(wobbleAngle1 * 2.3) * orb1.chaosX * 0.1;
            const chaosY1 = Math.cos(wobbleAngle1 * 1.7) * orb1.chaosY * 0.1;
            
            const driftAngle2 = elapsed * orb2.driftSpeed;
            const wobbleAngle2 = elapsed * orb2.wobbleSpeed;
            const spiralX2 = Math.cos(driftAngle2) * orb2.spiralRadius * (elapsed / orb2.growthDuration);
            const spiralY2 = Math.sin(driftAngle2 * 0.7) * orb2.spiralRadius * (elapsed / orb2.growthDuration);
            const chaosX2 = Math.sin(wobbleAngle2 * 2.3) * orb2.chaosX * 0.1;
            const chaosY2 = Math.cos(wobbleAngle2 * 1.7) * orb2.chaosY * 0.1;
            
            const x1 = (orb1.x + spiralX1 + chaosX1) * width;
            const y1 = (orb1.y + spiralY1 + chaosY1) * height;
            const x2 = (orb2.x + spiralX2 + chaosX2) * width;
            const y2 = (orb2.y + spiralY2 + chaosY2) * height;
            
            // Distance-based connection strength
            const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
            const maxDistance = Math.min(width, height) * 0.6;
            const connectionStrength = Math.max(0, 1 - distance / maxDistance);
            
            if (connectionStrength > 0.2) { // Lower threshold for more connections
              const finalOpacity = connectionOpacity * connectionStrength * pulseConnection;
              
              const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
              gradient.addColorStop(0, `rgba(${orb1.color.r}, ${orb1.color.g}, ${orb1.color.b}, ${finalOpacity})`);
              gradient.addColorStop(0.5, `rgba(147, 166, 190, ${finalOpacity * 0.5})`); // Brighter center
              gradient.addColorStop(1, `rgba(${orb2.color.r}, ${orb2.color.g}, ${orb2.color.b}, ${finalOpacity})`);
              
              // Enhanced wavy connection line with more visible thickness
              ctx.beginPath();
              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;
              const waveOffset = Math.sin(elapsed * 0.003 + i + j) * 25; // Stronger wave
              
              ctx.moveTo(x1, y1);
              ctx.quadraticCurveTo(midX + waveOffset, midY + waveOffset, x2, y2);
              ctx.strokeStyle = gradient;
              ctx.lineWidth = 1.5; // Thicker lines for visibility
              ctx.stroke();
            }
          }
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full ${className}`}
      style={{ 
        background: 'transparent',
        mixBlendMode: 'normal',
        minHeight: '300px',
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none'
      }}
    />
  );
}
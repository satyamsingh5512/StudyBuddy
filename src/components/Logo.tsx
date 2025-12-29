interface LogoProps {
  className?: string;
  animated?: boolean;
}

export default function Logo({ className = '', animated = false }: LogoProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="50%" stopColor="#d946ef" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
        <linearGradient id="logoGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#f0abfc" />
        </linearGradient>
      </defs>
      
      {/* Book base */}
      <path
        d="M6 12 C6 10 8 8 10 8 L18 8 C19 8 20 9 20 10 L20 30 C20 31 19 32 18 32 L10 32 C8 32 6 30 6 28 Z"
        fill="url(#logoGradient)"
        opacity="0.4"
        className={animated ? 'animate-pulse' : ''}
      />
      <path
        d="M34 12 C34 10 32 8 30 8 L22 8 C21 8 20 9 20 10 L20 30 C20 31 21 32 22 32 L30 32 C32 32 34 30 34 28 Z"
        fill="url(#logoGradient)"
        opacity="0.7"
        className={animated ? 'animate-pulse' : ''}
        style={{ animationDelay: '150ms' }}
      />
      
      {/* Bookmark ribbon */}
      <path
        d="M17 4 L17 16 L20 13 L23 16 L23 4 C23 3 22 2 21 2 L19 2 C18 2 17 3 17 4 Z"
        fill="url(#logoGradient2)"
        className={animated ? 'animate-bounce' : ''}
        style={{ animationDelay: '300ms' }}
      />
      
      {/* Sparkle */}
      <circle cx="28" cy="14" r="2" fill="url(#logoGradient2)" opacity="0.8"
        className={animated ? 'animate-ping' : ''} />
      <circle cx="12" cy="24" r="1.5" fill="url(#logoGradient2)" opacity="0.6"
        className={animated ? 'animate-ping' : ''} style={{ animationDelay: '500ms' }} />
    </svg>
  );
}

import { Link } from 'react-router-dom';

interface LogoProps {
    className?: string;
    animated?: boolean;
    highlighted?: boolean;
}

export default function Logo({ className = '', animated = false, highlighted = false, noLink = false }: LogoProps & { noLink?: boolean }) {
    const Content = (
        <svg
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={noLink ? className : "w-full h-full"}
        >
            {/* Book pages */}
            <path
                d="M8 10 L8 30 L20 28 L20 8 Z"
                fill="currentColor"
                opacity={highlighted ? 0.9 : 0.3}
                className={animated ? 'animate-pulse' : ''}
                style={{ animationDelay: '0ms' }}
            />
            <path
                d="M20 8 L20 28 L32 30 L32 10 Z"
                fill="currentColor"
                opacity={highlighted ? 1.0 : 0.5}
                className={animated ? 'animate-pulse' : ''}
                style={{ animationDelay: '150ms' }}
            />

            {/* Bookmark */}
            <path
                d="M18 6 L18 16 L20 14 L22 16 L22 6 Z"
                fill="currentColor"
                className={animated ? 'animate-pulse' : ''}
                style={{ animationDelay: '300ms' }}
            />
        </svg>
    );

    if (noLink) return Content;

    return (
        <Link to="/" className={`block ${className}`} title="Go to Homepage">
            {Content}
        </Link>
    );
}

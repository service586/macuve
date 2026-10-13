// Logo MaCuve : une goutte en forme de repère de carte, l'eau livrée à une adresse précise.
// Même dessin que src/app/icon.svg.
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="macuve-pin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#0369a1" />
        </linearGradient>
      </defs>
      <path
        d="M32 3C19 3 8.5 13.3 8.5 26.1 8.5 43.3 32 61 32 61S55.5 43.3 55.5 26.1C55.5 13.3 45 3 32 3Z"
        fill="url(#macuve-pin)"
        stroke="#fff"
        strokeWidth="2"
      />
      <circle cx="32" cy="26" r="13" fill="#fff" />
      <path d="M32 16.5S24.6 25.3 24.6 29.6a7.4 7.4 0 0 0 14.8 0C39.4 25.3 32 16.5 32 16.5Z" fill="#0284c7" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      <span className="text-xl font-extrabold tracking-tight">
        Ma<span className="text-sky-300">Cuve</span>
      </span>
    </span>
  );
}

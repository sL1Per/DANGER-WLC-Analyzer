/** Full-screen loading state: a WoW tinker-gnome hammering at an anvil while a
 *  gold nugget spins on it. Drawn inline as SVG so it's self-contained, crisp at
 *  any size, and themeable. Used while report data is fetched. */
export function LoadingNugget({ message = "Loading report…" }: { message?: string }) {
  return (
    <div className="loading-nugget" role="status" aria-live="polite">
      <svg
        className="loading-nugget-scene"
        viewBox="0 0 260 220"
        width="280"
        height="237"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="lg-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f6dd8b" />
            <stop offset="45%" stopColor="#d4a84a" />
            <stop offset="100%" stopColor="#9c7825" />
          </linearGradient>
          <linearGradient id="lg-anvil" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4a525f" />
            <stop offset="100%" stopColor="#2b313b" />
          </linearGradient>
          <linearGradient id="lg-overall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2f6f8f" />
            <stop offset="100%" stopColor="#1d4d66" />
          </linearGradient>
        </defs>

        {/* ground shadow */}
        <ellipse cx="135" cy="200" rx="92" ry="12" fill="rgba(0,0,0,0.28)" />

        {/* ── anvil ───────────────────────────────────── */}
        <g>
          <rect x="150" y="178" width="46" height="14" rx="3" fill="#222831" />
          <rect x="162" y="150" width="22" height="32" fill="url(#lg-anvil)" />
          <path d="M138 138 L208 138 L200 152 L146 152 Z" fill="url(#lg-anvil)" />
          <path d="M208 138 L226 134 L222 146 L200 150 Z" fill="#3a414c" />
          <rect x="138" y="135" width="70" height="5" rx="2" fill="#5a6472" />
        </g>

        {/* ── spinning gold nugget (sits on the anvil face) ── */}
        <g className="loading-nugget-spin" style={{ transformOrigin: "171px 128px" }}>
          <path
            d="M158 120 L170 114 L182 120 L186 130 L180 140 L168 142 L157 134 L155 126 Z"
            fill="url(#lg-gold)"
            stroke="#7a5d1c"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M158 120 L170 114 L166 126 Z" fill="#fbe9a8" opacity="0.7" />
          <path d="M182 120 L186 130 L176 130 Z" fill="#e7c468" opacity="0.5" />
          <circle cx="165" cy="124" r="2.4" fill="#fff6d6" opacity="0.9" />
        </g>

        {/* ── gnome ───────────────────────────────────── */}
        {/* legs + boots */}
        <g>
          <rect x="60" y="158" width="16" height="28" rx="5" fill="#1d4d66" />
          <rect x="84" y="158" width="16" height="28" rx="5" fill="#1d4d66" />
          <path d="M54 184 h26 a4 4 0 0 1 4 4 v4 h-34 v-4 a4 4 0 0 1 4 -4 Z" fill="#3a2c1c" />
          <path d="M82 184 h26 a4 4 0 0 1 4 4 v4 h-34 v-4 a4 4 0 0 1 4 -4 Z" fill="#3a2c1c" />
        </g>

        {/* torso / overalls */}
        <path d="M50 110 q30 -14 60 0 l6 54 q-36 12 -72 0 Z" fill="url(#lg-overall)" />
        <rect x="68" y="120" width="24" height="26" rx="5" fill="#28607d" />
        <circle cx="74" cy="128" r="2.4" fill="#d4a84a" />
        <circle cx="86" cy="128" r="2.4" fill="#d4a84a" />
        {/* shoulder straps */}
        <path d="M64 112 l8 -16 6 3 -7 16 Z" fill="#28607d" />
        <path d="M96 112 l-8 -16 -6 3 7 16 Z" fill="#28607d" />

        {/* back (left) arm resting on hip */}
        <path d="M52 116 q-14 8 -10 24 l9 -2 q-3 -12 8 -16 Z" fill="#2f6f8f" />

        {/* head */}
        <g>
          {/* beard */}
          <path d="M58 96 q22 34 44 0 q-6 22 -22 24 q-16 -2 -22 -24 Z" fill="#e8ecf2" />
          {/* face */}
          <circle cx="80" cy="86" r="24" fill="#e8b58c" />
          {/* big gnome nose */}
          <ellipse cx="80" cy="92" rx="8" ry="6.5" fill="#dd9f73" />
          {/* eyes */}
          <circle cx="71" cy="83" r="2.6" fill="#2b313b" />
          <circle cx="89" cy="83" r="2.6" fill="#2b313b" />
          {/* rosy cheeks */}
          <circle cx="66" cy="92" r="3.5" fill="#e88f6b" opacity="0.5" />
          <circle cx="94" cy="92" r="3.5" fill="#e88f6b" opacity="0.5" />
          {/* aviator cap */}
          <path d="M56 78 q24 -34 48 0 q-24 -14 -48 0 Z" fill="#5a4327" />
          <path d="M54 78 q26 -10 52 0 l-2 6 q-24 -8 -48 0 Z" fill="#6b5132" />
          {/* goggles pushed up on the cap */}
          <circle cx="68" cy="72" r="7" fill="#1b2026" stroke="#d4a84a" strokeWidth="2.5" />
          <circle cx="92" cy="72" r="7" fill="#1b2026" stroke="#d4a84a" strokeWidth="2.5" />
          <circle cx="68" cy="72" r="3" fill="#7fd4e8" opacity="0.8" />
          <circle cx="92" cy="72" r="3" fill="#7fd4e8" opacity="0.8" />
          <rect x="74" y="70" width="12" height="3.5" rx="1.5" fill="#3a2c1c" />
        </g>

        {/* front (right) arm + hammer — swings as he works */}
        <g className="loading-nugget-arm" style={{ transformOrigin: "104px 118px" }}>
          <path d="M100 116 q22 0 30 -12 l7 6 q-10 16 -34 18 Z" fill="#2f6f8f" />
          <circle cx="134" cy="106" r="6.5" fill="#e8b58c" />
          {/* hammer */}
          <rect x="132" y="78" width="5" height="30" rx="2.5" fill="#7a5a34" transform="rotate(28 134 100)" />
          <rect x="120" y="70" width="26" height="13" rx="3" fill="#3a414c" transform="rotate(28 134 100)" />
          <rect x="120" y="70" width="7" height="13" rx="3" fill="#5a6472" transform="rotate(28 134 100)" />
        </g>
      </svg>
      <p className="loading-nugget-text">{message}</p>
    </div>
  );
}

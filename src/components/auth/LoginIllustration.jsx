// Flat illustration for the login page: the Pinta ship sailing inside a soft blob,
// with a book (learning), a star (achievement) and an XP coin around it.
// Static on purpose (no animation) so the page stays calm.

const BLOB =
  "M282 48C372 44 462 98 484 186C506 274 456 372 362 404C268 436 150 418 96 346C42 274 62 160 128 102C168 66 222 50 282 48Z";

const STAR =
  "M0 -20L5.29 -7.28L19.02 -6.18L8.56 2.78L11.76 16.18L0 9L-11.76 16.18L-8.56 2.78L-19.02 -6.18L-5.29 -7.28Z";

const sparkle = (cx, cy, s) =>
  `M${cx} ${cy - s}C${cx} ${cy - s * 0.3} ${cx + s * 0.3} ${cy} ${cx + s} ${cy}` +
  `C${cx + s * 0.3} ${cy} ${cx} ${cy + s * 0.3} ${cx} ${cy + s}` +
  `C${cx} ${cy + s * 0.3} ${cx - s * 0.3} ${cy} ${cx - s} ${cy}` +
  `C${cx - s * 0.3} ${cy} ${cx} ${cy - s * 0.3} ${cx} ${cy - s}Z`;

const BUBBLES = [
  [42, 178, 13],
  [522, 302, 17],
  [508, 92, 9],
  [66, 398, 10],
  [540, 204, 6],
];

const PORTHOLES = [246, 272, 298, 324];

const ripple = (x, y) => `M${x} ${y}c6-3 12-3 18 0`;

const LoginIllustration = () => (
  <svg viewBox="0 0 560 460" className="block h-auto w-full" role="img" aria-label="Pinta ship sailing">
    <defs>
      <linearGradient id="lpi-blob" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#dcecfa" />
        <stop offset="1" stopColor="#eef6fd" />
      </linearGradient>
      <radialGradient id="lpi-bubble" cx="0.35" cy="0.35" r="0.7">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.7" stopColor="#eaf4fc" />
        <stop offset="1" stopColor="#cfe5f7" />
      </radialGradient>
      <linearGradient id="lpi-sail" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#d6e8f8" />
      </linearGradient>
      <linearGradient id="lpi-jib" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#eef6fd" />
        <stop offset="1" stopColor="#c3dcf3" />
      </linearGradient>
      <clipPath id="lpi-clip">
        <path d={BLOB} />
      </clipPath>
      <filter id="lpi-soft" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
    </defs>

    {/* Bubbles around the blob */}
    {BUBBLES.map(([cx, cy, r]) => (
      <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="url(#lpi-bubble)" stroke="#cfe5f7" strokeWidth="1" />
    ))}

    {/* Blob + its soft shadow */}
    <ellipse cx="282" cy="430" rx="170" ry="12" fill="#0b2d84" opacity="0.08" filter="url(#lpi-soft)" />
    <path d={BLOB} fill="url(#lpi-blob)" />

    <g clipPath="url(#lpi-clip)">
      {/* Darker inner circle so the white sails stand out */}
      <circle cx="292" cy="205" r="118" fill="#cde3f6" />

      {/* Clouds */}
      <g fill="#ffffff">
        <circle cx="160" cy="158" r="11" />
        <circle cx="178" cy="150" r="16" />
        <circle cx="197" cy="158" r="10" />
        <rect x="149" y="156" width="58" height="12" rx="6" />
      </g>
      <g fill="#ffffff" opacity="0.95">
        <circle cx="336" cy="106" r="8" />
        <circle cx="350" cy="100" r="12" />
        <circle cx="365" cy="106" r="7" />
        <rect x="328" y="105" width="44" height="9" rx="4.5" />
      </g>

      {/* Back wave (behind the ship) */}
      <path
        d="M40 296C100 280 160 308 220 294C280 280 340 306 400 292C450 281 490 300 530 292V470H40Z"
        fill="#a9d3f5"
      />

      {/* Ship */}
      <g>
        <path d="M283 134L194 266" stroke="#0b2d84" strokeWidth="1.5" opacity="0.45" />
        <path d="M283 134L404 262" stroke="#0b2d84" strokeWidth="1.5" opacity="0.45" />
        <path d="M366 286L406 260" stroke="#0b2d84" strokeWidth="5" strokeLinecap="round" />
        <path d="M296 170L400 262L340 276Z" fill="url(#lpi-jib)" />
        <rect x="279" y="128" width="7" height="160" rx="3.5" fill="#0b2d84" />
        <path d="M286 130C295 132 303 136 314 137C303 140 295 145 286 147Z" fill="#fbbf24" />

        <path d="M262 154H303C311 164 313 176 307 188H258C254 176 256 164 262 154Z" fill="url(#lpi-sail)" />
        <path d="M248 196H317C327 208 329 224 323 238H242C236 224 238 208 248 196Z" fill="url(#lpi-sail)" />
        <path d="M236 246H331C342 256 344 268 337 280H232C226 268 227 256 236 246Z" fill="url(#lpi-sail)" />
        <rect x="254" y="149" width="58" height="6" rx="3" fill="#0b2d84" />
        <rect x="240" y="191" width="86" height="6" rx="3" fill="#0b2d84" />
        <rect x="228" y="241" width="110" height="6" rx="3" fill="#0b2d84" />

        <path d="M184 286V268C184 265 186 263 189 263H224V286Z" fill="#0b2d84" />
        <rect x="193" y="269" width="8" height="7" rx="1.5" fill="#d9ecfb" />
        <rect x="207" y="269" width="8" height="7" rx="1.5" fill="#d9ecfb" />

        <path d="M182 284H374C368 307 347 323 306 327H256C215 323 192 307 182 284Z" fill="#0b2d84" />
        <path d="M190 293H366C364 299 360 304 355 308H201C196 304 192 299 190 293Z" fill="#0064b1" />
        {PORTHOLES.map((x) => (
          <circle key={x} cx={x} cy="315" r="3.4" fill="#d9ecfb" />
        ))}
        <rect x="178" y="279" width="200" height="7" rx="3.5" fill="#082070" />
      </g>

      {/* Front waves */}
      <path
        d="M40 328C90 316 150 338 210 326C270 314 330 338 390 326C440 316 490 334 530 326V470H40Z"
        fill="#5aa8e6"
      />
      <path
        d="M40 352C100 338 160 364 220 350C280 336 340 362 400 348C450 338 490 356 530 348V470H40Z"
        fill="#1b7fd1"
      />
      <path
        d="M40 382C110 370 170 392 240 380C300 370 360 390 420 378C470 370 500 386 530 380V470H40Z"
        fill="#0064b1"
      />
      <g stroke="#ffffff" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.85">
        <path d={ripple(380, 330)} />
        <path d={ripple(154, 332)} />
        <path d={ripple(424, 356)} />
        <path d={ripple(118, 360)} />
      </g>
    </g>

    {/* Seagulls */}
    <g stroke="#0b2d84" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.55">
      <path d="M212 104q6-6 12 0q6-6 12 0" />
      <path d="M240 90q5-5 10 0q5-5 10 0" />
    </g>

    {/* Floating book */}
    <ellipse cx="434" cy="180" rx="30" ry="6" fill="#0b2d84" opacity="0.1" filter="url(#lpi-soft)" />
    <g transform="translate(430 122) rotate(-12)">
      <path d="M-46 -20Q0 -12 46 -20V30Q0 38 -46 30Z" fill="#0064b1" />
      <path d="M-42 -25Q-21 -30 0 -19V27Q-21 17 -42 23Z" fill="#ffffff" />
      <path d="M42 -25Q21 -30 0 -19V27Q21 17 42 23Z" fill="#f2f8fe" />
      <path d="M0 -19V27" stroke="#cfe5f7" strokeWidth="2" />
      <g stroke="#a9d3f5" strokeWidth="2.5" strokeLinecap="round" fill="none">
        <path d="M-34 -12Q-20 -16 -7 -9" />
        <path d="M-34 -2Q-20 -6 -7 1" />
        <path d="M-34 8Q-20 4 -7 11" />
        <path d="M34 -12Q20 -16 7 -9" />
        <path d="M34 -2Q20 -6 7 1" />
        <path d="M34 8Q20 4 7 11" />
      </g>
    </g>

    {/* Star */}
    <ellipse cx="124" cy="146" rx="16" ry="4" fill="#0b2d84" opacity="0.1" filter="url(#lpi-soft)" />
    <g transform="translate(120 110) rotate(-14)">
      <path d={STAR} fill="#fbbf24" stroke="#fbbf24" strokeWidth="5" strokeLinejoin="round" />
    </g>

    {/* XP coin */}
    <g transform="translate(98 232)">
      <circle cy="3" r="18" fill="#f59e0b" />
      <circle r="18" fill="#fbbf24" />
      <circle r="12.5" fill="none" stroke="#f59e0b" strokeWidth="2" />
      <text
        y="0.5"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="11"
        fontWeight="800"
        fill="#b45309"
        fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
      >
        XP
      </text>
    </g>

    {/* Sparkles */}
    <path d={sparkle(470, 214, 7)} fill="#fbbf24" />
    <path d={sparkle(152, 206, 5)} fill="#5aa8e6" />
    <path d={sparkle(400, 58, 5)} fill="#fbbf24" />
  </svg>
);

export default LoginIllustration;

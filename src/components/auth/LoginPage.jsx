import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { REGISTER_PATH } from "../../config/registration";
import { useAuth } from "../../hooks/useAuth";
import { Eye, EyeOff, Loader2, AlertCircle, ArrowBigUp } from "lucide-react";
import { supabase } from "../../supabase/client";
import { assetUrl, useBranding } from "../../hooks/useBranding";
import LoginIllustration from "./LoginIllustration";

// Default fallback image (same as Dashboard/Profile)
const DEFAULT_LOGIN_IMAGE =
  "https://images.unsplash.com/photo-1557683316-973673baf926?w=1200&h=400&fit=crop";

// Remember the last image links so repeat visits paint them without waiting for Supabase:
// the PC background, and the phone art from Admin > Branding ("" = none set, show the ship)
const BG_CACHE_KEY = "login_bg_url";
const ART_CACHE_KEY = "login_mobile_art_url";

const readCache = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeCache = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode / blocked storage: just skip the cache
  }
};

// The PC card from Tailwind's lg up; phones and tablets get the full-screen layout
const DESKTOP_QUERY = "(min-width: 1024px)";

const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    // Safari before 14 only has addListener/removeListener
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, [query]);

  return matches;
};

// Colours sampled from the login background and the Pinta emblem
const BRAND_BLUE = "#0064b1";
const PLACEHOLDER_BG = "linear-gradient(135deg, #0b3490 0%, #082076 50%, #04145f 100%)";
const PANEL_BG = "linear-gradient(160deg, #0d3592 0%, #0a2a7e 45%, #061b63 100%)";

// White organic shape on the card (PC); its right edge is the S-curve
const DESKTOP_BLOB = "M0 0H63C57 0 54 9 54 22C54 38 58 50 57 62C56 76 59 86 64 93C67 97 70 100 74 100H0Z";
// Phone/tablet: the PC S-curve turned on its side (point (x, y) of DESKTOP_BLOB's edge -> (y, x - 52)),
// white above, navy below; its rounded ends echo the corners of the PC card
const MOBILE_CURVE = "M0 0V11C0 5 9 2 22 2C38 2 50 6 62 5C76 4 86 7 93 12C97 15 100 18 100 22V0Z";

// Phone art fills the room left between the logo and the curve, centred and capped on tall screens.
// The ship scales freely; a picture keeps its own size at most (no blurry upscaling), and its box
// matches the picture so the rounded corners land on it
const SHIP_FIT =
  "absolute inset-0 m-auto block h-full w-full max-h-[340px] max-w-[440px] sm:max-h-[420px] sm:max-w-[540px]";
const PICTURE_FIT =
  "absolute inset-0 m-auto block max-h-[min(100%,340px)] max-w-[min(100%,440px)] rounded-3xl sm:max-h-[min(100%,420px)] sm:max-w-[min(100%,540px)]";
// Below this the art is hidden rather than shown as a thumbnail
const MIN_ART_HEIGHT = 64;

// ilike treats % and _ as wildcards: escape them so "minh_anh" only matches itself
const escapeLike = (value) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

// Fade an <img> in once it has loaded. An image already in cache is shown at once
// (checked before paint), so it never blinks on repeat visits.
const useImageReady = (src) => {
  const ref = useRef(null);
  const [readySrc, setReadySrc] = useState(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (src && el?.complete && el.naturalWidth > 0) setReadySrc(src);
  }, [src]);

  return { ref, ready: Boolean(src) && readySrc === src, onLoad: () => setReadySrc(src) };
};

// The logo file is white; on the white card it is drawn in brand blue through a CSS mask.
// The mask needs CORS, so preload it that way: "failed" falls back to the branding logo.
const useMaskImage = (src) => {
  const [state, setState] = useState({ src: null, status: "loading" });

  useLayoutEffect(() => {
    if (!src) return undefined;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!cancelled) setState({ src, status: "ready" });
    };
    img.onerror = () => {
      if (!cancelled) setState({ src, status: "failed" });
    };
    img.src = src;
    if (img.complete && img.naturalWidth > 0) setState({ src, status: "ready" });
    return () => {
      cancelled = true;
    };
  }, [src]);

  return state.src === src ? state.status : "loading";
};

const STYLES = `
  .lp-root { min-height: 100vh; min-height: 100dvh; }

  .lp-logo {
    background-color: ${BRAND_BLUE};
    -webkit-mask: var(--lp-logo) left center / contain no-repeat;
            mask: var(--lp-logo) left center / contain no-repeat;
  }

  /* Keep Chrome's autofill from painting the dark fields yellow/blue */
  .lp-input:-webkit-autofill {
    -webkit-box-shadow: 0 0 0 1000px #061a55 inset;
    -webkit-text-fill-color: #fff;
    caret-color: #fff;
  }
  .lp-input:-webkit-autofill:focus {
    -webkit-box-shadow: 0 0 0 1000px #061a55 inset, 0 0 0 4px rgba(125, 211, 252, .15);
  }
  .lp-input:-webkit-autofill ~ .lp-label { top: 17px; font-size: 12px; line-height: 16px; }

  /* Phone/tablet on a short screen (e.g. iPhone SE with Safari's bars): tighter spacing so the
     whole form still fits without scrolling; the art takes whatever height is left */
  @media (max-height: 640px) {
    .lp-m .lp-m-top { padding-top: 14px; }
    .lp-m .lp-m-logo { height: 56px; width: 76px; }
    .lp-m .lp-m-curve { height: 44px; }
    .lp-m .lp-m-form { padding-bottom: 24px; }
    .lp-m .lp-title { margin-bottom: 20px; font-size: 26px; }
    .lp-m .lp-signup { margin-top: 18px; }
  }
  /* No room for a picture (landscape phone, keyboard open in some in-app browsers) */
  @media (max-height: 520px) {
    .lp-m .lp-m-slot { display: none; }
  }

  .lp-fade-in { animation: lp-fade-in .5s ease-out both; }
  @keyframes lp-fade-in { from { opacity: 0; } }

  @media (prefers-reduced-motion: reduce) {
    .lp-root * { transition-duration: .001ms !important; animation-duration: .001ms !important; }
  }
`;

// Floating label: sits inside the empty field, moves up once focused or filled
const INPUT_CLASS =
  "lp-input peer block h-14 w-full rounded-full border border-white/10 bg-[#061a55] pb-2 pl-6 pt-6 text-base text-white outline-none transition-[border-color,box-shadow] hover:border-white/25 focus:border-sky-300/70 focus:ring-4 focus:ring-sky-300/15";
const LABEL_CLASS =
  "lp-label pointer-events-none absolute left-6 top-[17px] -translate-y-1/2 text-xs font-medium text-sky-200/80 transition-all duration-150 peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-[15px] peer-placeholder-shown:text-white/50 peer-focus:top-[17px] peer-focus:text-xs peer-focus:text-sky-200";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bgUrl, setBgUrl] = useState(() => readCache(BG_CACHE_KEY));
  const failedBgs = useRef(new Set());

  const { user, signIn } = useAuth();
  const { branding, loading: brandingLoading } = useBranding();
  const location = useLocation();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  const logoSrc = assetUrl("/image/Logo_Pinta.png");
  const appName = branding?.appName || "Logo";
  const bg = useImageReady(bgUrl);
  const logoStatus = useMaskImage(logoSrc);

  // Phone art from Admin > Branding: null = not known yet (first visit, settings still loading),
  // "" = none set. While unknown the slot stays empty rather than flash the ship and swap it out.
  const [cachedArt] = useState(() => readCache(ART_CACHE_KEY));
  const savedArt = brandingLoading ? null : branding?.loginMobileImageUrl || "";
  const artUrl = savedArt ?? cachedArt;
  const [shipAtFirstPaint] = useState(artUrl === "");
  const [failedArt, setFailedArt] = useState(null);
  const showArtImage = Boolean(artUrl) && artUrl !== failedArt;
  const art = useImageReady(showArtImage ? artUrl : null);

  // The art gets whatever height the form leaves. Squeezed to a sliver (e.g. an error message on
  // a short phone) a thumbnail-sized picture looks broken, so hide it until there is room again.
  // (A CSS container query can't do this here: Chrome evaluates it on the flex item's first, 0px pass.)
  const slotRef = useRef(null);
  const [slotTooSmall, setSlotTooSmall] = useState(false);
  useEffect(() => {
    const el = slotRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => setSlotTooSmall(entry.contentRect.height < MIN_ART_HEIGHT));
    observer.observe(el);
    return () => observer.disconnect();
  }, [isDesktop]);

  const from = location.state?.from?.pathname || "/";

  useEffect(() => {
    if (savedArt !== null) writeCache(ART_CACHE_KEY, savedArt);
  }, [savedArt]);

  // PC background image from settings (cached value, if any, is already showing).
  // The phone layout covers the whole screen, so phones don't fetch it.
  useEffect(() => {
    if (!isDesktop) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const { data, error: settingError } = await supabase
          .from("site_settings")
          .select("setting_value")
          .eq("setting_key", "login_page_image")
          .maybeSingle();
        if (cancelled) return;
        if (settingError) throw settingError;

        const url = data?.setting_value || DEFAULT_LOGIN_IMAGE;
        if (failedBgs.current.has(url)) return;
        writeCache(BG_CACHE_KEY, url);
        setBgUrl(url);
      } catch (err) {
        console.error("Failed to load login image:", err);
        if (!cancelled) setBgUrl((current) => current || DEFAULT_LOGIN_IMAGE);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isDesktop]);

  if (user) {
    return <Navigate to={from} replace />;
  }

  const handleBgError = () => {
    if (bgUrl) failedBgs.current.add(bgUrl);
    if (bgUrl !== DEFAULT_LOGIN_IMAGE) setBgUrl(DEFAULT_LOGIN_IMAGE);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");

    try {
      // Check if input is email or username
      let loginEmail = username.trim();

      if (!loginEmail.includes("@")) {
        // It's a username, lookup the email from users table (case-insensitive)
        const { data, error: lookupError } = await supabase
          .from("users")
          .select("email")
          .ilike("username", escapeLike(loginEmail))
          .single();

        if (lookupError || !data) {
          setError("Không tìm thấy tài khoản với username này");
          return;
        }

        loginEmail = data.email;
      }

      const { error } = await signIn(loginEmail, password);
      if (error) {
        setError("Email/Username hoặc mật khẩu không chính xác");
      }
    } catch {
      setError("Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setLoading(false);
    }
  };

  // Google sign-in is hidden for now (see commented button below)
  // eslint-disable-next-line no-unused-vars
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
    } catch {
      setError("Không thể đăng nhập Google. Vui lòng thử lại");
      setLoading(false);
    }
  };

  const handleCapsLock = (e) => {
    if (e.getModifierState) setCapsLock(e.getModifierState("CapsLock"));
  };

  const logo =
    logoStatus === "failed" ? (
      branding?.logoUrl && <img src={branding.logoUrl} alt={appName} className="h-full w-auto object-contain" />
    ) : (
      <div
        role="img"
        aria-label={appName}
        className={`lp-logo h-full w-full transition-opacity duration-300 ${logoStatus === "ready" ? "opacity-100" : "opacity-0"}`}
        style={{ "--lp-logo": `url("${logoSrc}")` }}
      />
    );

  // Title + the two fields + Log in + Sign up: the very same block on PC and on phones
  const formBlock = (
    <div className="mx-auto w-full max-w-[340px]">
      <h1 className="lp-title mb-7 text-[28px] font-bold tracking-tight text-white sm:text-[32px]">
        Welcome to XPClass
      </h1>

      <form onSubmit={handleSubmit}>
        {error && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-2xl border border-red-400/30 bg-red-500/15 px-4 py-3 text-sm text-red-100"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3">
          {/* Username Field */}
          <div className="relative">
            <input
              id="login-username"
              name="username"
              type="text"
              required
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder=" "
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (error) setError("");
              }}
              className={`${INPUT_CLASS} pr-6`}
            />
            <label htmlFor="login-username" className={LABEL_CLASS}>
              Username
            </label>
          </div>

          {/* Password Field */}
          <div>
            <div className="relative">
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder=" "
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                }}
                onKeyDown={handleCapsLock}
                onKeyUp={handleCapsLock}
                onBlur={() => setCapsLock(false)}
                className={`${INPUT_CLASS} pr-14`}
              />
              <label htmlFor="login-password" className={LABEL_CLASS}>
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-white/50 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {capsLock && (
              <p className="mt-2 flex items-center gap-1 px-3 text-xs font-medium text-amber-300">
                <ArrowBigUp className="h-3.5 w-3.5" /> Caps Lock is on
              </p>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#5cb3ff] text-[15px] font-bold text-[#061b63] shadow-[0_10px_24px_-10px_rgba(92,179,255,0.7)] transition hover:bg-[#7fc4ff] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-300/40 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Logging in...
            </>
          ) : (
            "Log in"
          )}
        </button>
      </form>

      {/* Google Sign-In - Hidden */}
      {/* <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-full border border-white/15 text-[15px] font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
      >
        <img
          src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
          alt="Google"
          className="h-5 w-5"
        />
        Google
      </button> */}

      <p className="lp-signup mt-7 text-center text-sm text-white/60">
        New here?{" "}
        <Link
          to={REGISTER_PATH}
          className="font-semibold text-sky-300 underline-offset-4 hover:text-sky-200 hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );

  if (isDesktop) {
    return (
      <div className="lp-root relative isolate flex items-center justify-center p-8">
        <style>{STYLES}</style>

        {/* Page background: the admin's login image */}
        <div className="fixed inset-0 -z-10" style={{ background: PLACEHOLDER_BG }} aria-hidden="true">
          {bgUrl && (
            <img
              ref={bg.ref}
              src={bgUrl}
              alt=""
              decoding="async"
              draggable={false}
              onLoad={bg.onLoad}
              onError={handleBgError}
              className={`h-full w-full select-none object-cover transition-opacity duration-500 ${bg.ready ? "opacity-100" : "opacity-0"}`}
            />
          )}
          <div className="absolute inset-0 bg-[#020a2e]/20" />
        </div>

        {/* Card */}
        <div
          className="relative grid h-[min(640px,calc(100dvh-64px))] min-h-[560px] w-full max-w-[1080px] grid-cols-[56%_44%] overflow-hidden rounded-[40px] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.65)] ring-1 ring-white/10"
          style={{ background: PANEL_BG }}
        >
          <svg
            className="absolute inset-0 block h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d={DESKTOP_BLOB} fill="#ffffff" />
          </svg>

          {/* Brand side: logo + illustration */}
          <section className="relative flex items-center justify-center p-10">
            <div className="absolute left-10 top-10 h-[100px] w-[135px]">{logo}</div>

            <div className="mx-auto w-[min(100%,470px)]">
              <LoginIllustration />
            </div>
          </section>

          {/* Form side */}
          <main className="relative flex items-center justify-center px-12 py-10">{formBlock}</main>
        </div>
      </div>
    );
  }

  // Phone art: the admin's picture once loaded, else the ship (also when the link is broken)
  let artContent = null;
  if (showArtImage) {
    artContent = (
      <img
        ref={art.ref}
        src={artUrl}
        alt=""
        decoding="async"
        draggable={false}
        onLoad={art.onLoad}
        onError={() => setFailedArt(artUrl)}
        className={`${PICTURE_FIT} select-none transition-opacity duration-500 ${art.ready ? "opacity-100" : "opacity-0"}`}
      />
    );
  } else if (artUrl !== null) {
    artContent = <LoginIllustration className={`${SHIP_FIT} ${shipAtFirstPaint ? "" : "lp-fade-in"}`} />;
  }

  // Phones and tablets: full screen, white top (logo + art), S-curve, navy form down to the bottom
  return (
    <div className="lp-root lp-m relative flex flex-col bg-white">
      <style>{STYLES}</style>

      <section className="lp-m-top relative flex flex-1 flex-col px-6 pt-5 sm:px-10 sm:pt-8">
        <div className="lp-m-logo relative h-[76px] w-[103px] shrink-0 sm:h-[100px] sm:w-[135px]">{logo}</div>
        <div ref={slotRef} className={`lp-m-slot relative mt-3 min-h-0 flex-1 ${slotTooSmall ? "invisible" : ""}`}>
          {artContent}
        </div>
      </section>

      <div className="relative -mt-px shrink-0" style={{ background: PANEL_BG }}>
        <svg
          className="lp-m-curve block h-16 w-full"
          viewBox="0 0 100 24"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d={MOBILE_CURVE} fill="#ffffff" />
        </svg>

        <main className="lp-m-form relative px-6 pb-9 pt-2 sm:px-10">{formBlock}</main>
      </div>
    </div>
  );
};

export default LoginPage;

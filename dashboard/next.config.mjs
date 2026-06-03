/** @type {import('next').NextConfig} */
const nextConfig = {
  // 本番: NEXT_PUBLIC_API_URL を空にすると /api/* が Next.js プロキシルートに流れる
  // 開発: .env.local の NEXT_PUBLIC_API_URL=http://localhost:3002 をそのまま使う

  async headers() {
    return [
      {
        // Apply security headers to all routes.
        source: "/(.*)",
        headers: [
          // Prevent clickjacking — disallow this site from being embedded in
          // any iframe (login pages / dashboard should never be framed).
          { key: "X-Frame-Options", value: "DENY" },
          // Prevent MIME-type sniffing — browser must honour the declared
          // Content-Type instead of guessing from content.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Referrer policy — only send the origin (not the full path) on
          // cross-origin requests, and nothing on downgrade (HTTPS→HTTP).
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Permissions policy — opt out of browser features we don't use.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },

  async redirects() {
    return [
      // /start/free was the legacy "8-step mailto for manual provisioning"
      // onboarding form. Now /app does everything for real (instant
      // endpoint creation, real Pay Token JWTs, live gateway). Inbound
      // links from cold emails / HN / docs still resolve cleanly.
      { source: "/start/free", destination: "/app", permanent: true },

      // /sellers was the v1 USDC "lc.charge() in 3 lines" pitch wired to a
      // dead Railway backend (skillful-blessing-production.up.railway.app).
      // Current product is the /app gateway + Stripe Connect Express path.
      // Inbound seller traffic should land in the actual workspace.
      { source: "/sellers", destination: "/app", permanent: true },

      // /en/about was a prefix-style EN URL the old LangSwitcher generated.
      // It never had a route file (404). EN canonical is the suffix form
      // /about/en. Redirect so any cached / bookmarked / indexed old links
      // land on the real page instead of 404ing.
      { source: "/en/about", destination: "/about/en", permanent: true },
    ];
  },
};

export default nextConfig;

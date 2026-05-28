/** @type {import('next').NextConfig} */
const nextConfig = {
  // 本番: NEXT_PUBLIC_API_URL を空にすると /api/* が Next.js プロキシルートに流れる
  // 開発: .env.local の NEXT_PUBLIC_API_URL=http://localhost:3002 をそのまま使う

  async redirects() {
    return [
      // /start/free was the legacy "8-step mailto for manual provisioning"
      // onboarding form. Now /app does everything for real (instant
      // endpoint creation, real Pay Token JWTs, live gateway). Inbound
      // links from cold emails / HN / docs still resolve cleanly.
      { source: "/start/free", destination: "/app", permanent: true },
    ];
  },
};

export default nextConfig;

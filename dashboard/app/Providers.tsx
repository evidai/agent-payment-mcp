"use client";

/**
 * Top-level client-side provider tree.
 *
 * Why this file:
 *   The root layout is a server component (for SEO + metadata), so the
 *   wallet provider tree has to live in a client island. Anything that
 *   needs access to Privy hooks (`usePrivy`, `useWallets`, etc.) is
 *   rendered below this component.
 *
 *   The wrapper is intentionally conditional on `NEXT_PUBLIC_PRIVY_APP_ID`
 *   so we can ship the code path before the App ID is provisioned:
 *     - With the env var set → real Privy auth + embedded wallet.
 *     - Without it → children render as-is (legacy /start, /start/v2 in
 *       mocked-signature mode, every other page unaffected).
 *
 *   When the App ID is added in Vercel → no code change needed; the
 *   provider activates on the next deploy.
 */

import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export function Providers({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) {
    // No Privy app id configured yet — render the app without the
    // auth provider so unrelated pages keep working. /start/v2 will
    // detect this and stay in mocked-signature mode.
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // Embedded wallets for users who sign in with Google / email.
        // Self-custodial — keys never leave the user's device.
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
        // Match the LemonCake brand on the login modal.
        appearance: {
          theme: "light",
          accentColor: "#F5C518",
          logo: "https://lemoncake.xyz/logo.png",
        },
        // Login methods we expose. Email is a fallback for users who
        // dislike Google sign-in. Wallet connect lets external EOAs in
        // (MetaMask / Phantom-via-WC); they bring their own custody and
        // we never touch the keys anyway.
        loginMethods: ["google", "email", "wallet"],
        // Base mainnet is the default chain — USDC native, cheap gas.
        // Polygon kept as fallback for users already on it.
        defaultChain: {
          id: 8453,
          name: "Base",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: {
            default: { http: ["https://mainnet.base.org"] },
          },
          blockExplorers: {
            default: { name: "BaseScan", url: "https://basescan.org" },
          },
        },
        supportedChains: [
          {
            id: 8453,
            name: "Base",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: { default: { http: ["https://mainnet.base.org"] } },
            blockExplorers: { default: { name: "BaseScan", url: "https://basescan.org" } },
          },
          {
            id: 137,
            name: "Polygon",
            nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
            rpcUrls: { default: { http: ["https://polygon-rpc.com"] } },
            blockExplorers: { default: { name: "PolygonScan", url: "https://polygonscan.com" } },
          },
        ],
      }}
    >
      {children}
    </PrivyProvider>
  );
}

/**
 * Helper for downstream components to check whether Privy is actually
 * wired up (vs the stub `<>{children}</>` branch above).
 */
export const PRIVY_ENABLED = PRIVY_APP_ID.length > 0;

"use client";

/**
 * Top-level client-side provider tree.
 *
 * Composes three layers:
 *   1. PrivyProvider — Google / Email login → embedded wallet (existing
 *      onboarding path; works without USDC).
 *   2. WagmiProvider — bridges Privy's embedded wallet to viem hooks
 *      and lets us drop in Coinbase Smart Wallet as a parallel connector.
 *   3. OnchainKitProvider — gives the FundCard / `<Buy>` flows access to
 *      Coinbase Onramp (Apple Pay → USDC in ≈30s when configured).
 *
 *   Each layer is guarded by its own env var. The page tree degrades
 *   gracefully when keys are missing:
 *     - No PRIVY_APP_ID  → bare children, /start/v2 will show a clear
 *       "auth not configured" state (no more silent mock signing).
 *     - No COINBASE_PROJECT_ID → Wagmi + Privy still work; the Apple
 *       Pay onramp UI hides.
 *
 *   Why both Privy and Wagmi? Privy owns the auth/wallet creation UX
 *   and stays the source of truth for the user's address. Wagmi exists
 *   purely so we can hand the same address to OnchainKit's hooks
 *   without writing a custom adapter.
 */

import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider, createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { coinbaseWallet } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OnchainKitProvider } from "@coinbase/onchainkit";

const PRIVY_APP_ID         = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
const COINBASE_PROJECT_ID  = process.env.NEXT_PUBLIC_COINBASE_PROJECT_ID ?? "";

// Single wagmi config — Base only for now. Coinbase Smart Wallet is the
// primary connector; users who already have MetaMask still go through
// Privy's wallet-connect path, which mounts above wagmi.
const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    coinbaseWallet({
      appName: "LemonCake",
      appLogoUrl: "https://lemoncake.xyz/logo.png",
      preference: "smartWalletOnly", // forces passkey / Apple Pay path
    }),
  ],
  transports: {
    [base.id]: http("https://mainnet.base.org"),
  },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) {
    // No Privy app id configured yet — render the app without the
    // auth provider so unrelated pages keep working. /start/v2 will
    // surface a configuration warning instead of silently mocking.
    return <>{children}</>;
  }

  const wrapped = (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {COINBASE_PROJECT_ID ? (
          <OnchainKitProvider apiKey={COINBASE_PROJECT_ID} chain={base}>
            {children}
          </OnchainKitProvider>
        ) : (
          children
        )}
      </QueryClientProvider>
    </WagmiProvider>
  );

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
      {wrapped}
    </PrivyProvider>
  );
}

/**
 * Helper for downstream components to check whether the relevant
 * upstream services are wired up.
 */
export const PRIVY_ENABLED    = PRIVY_APP_ID.length > 0;
export const COINBASE_ENABLED = COINBASE_PROJECT_ID.length > 0;

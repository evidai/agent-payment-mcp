import { Providers } from "../../Providers";

/* /start/v2 is the only route that uses Privy / Wagmi / OnchainKit, so the
 * provider tree (and its very large client bundle) lives here instead of the
 * root layout. */
export default function StartV2Layout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}

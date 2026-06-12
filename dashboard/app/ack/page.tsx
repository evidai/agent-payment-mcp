import type { Metadata } from "next";
import AckClient from "./AckClient";

export const metadata: Metadata = {
  title: "ACK-Pay Interop — LemonCake speaks Agent Commerce Kit",
  description:
    "LemonCake is a production x402 gateway that natively speaks Catena Labs' ACK-Pay: signed payment requests in every 402, W3C verifiable payment receipts, and a did:web identity anyone can verify. Watch the full loop run live.",
  alternates: { canonical: "https://lemoncake.xyz/ack" },
  openGraph: {
    title: "LemonCake × ACK-Pay — live interop demo",
    description:
      "Signed 402 payment requests, W3C verifiable receipts, did:web identity. The full Agent Commerce Kit loop, running in production.",
    url: "https://lemoncake.xyz/ack",
    siteName: "LemonCake",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function AckPage() {
  return <AckClient />;
}

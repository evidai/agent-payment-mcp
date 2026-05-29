/**
 * Self-hosted social sign-in (Google + GitHub) for the seller dashboard.
 *
 * No third-party auth SDK — just the providers' standard OAuth 2.0
 * Authorization Code flow. The whole point is to plug into the SAME owner
 * model the email magic-link already uses:
 *
 *   provider sign-in → resolve/create lc_owners row → pin lc_owner cookie
 *
 * Social identities are recorded in lc_oauth_identities keyed on
 * (provider, subject) so a returning user lands on the same workspace
 * regardless of which provider — or the magic link — they used.
 *
 * Security notes:
 *   - Client secrets stay server-side (read from env, never sent to client).
 *   - CSRF is covered by a one-shot state nonce stored in an httpOnly cookie
 *     (set in the /start route, compared in /callback).
 *   - Email-based linking to an EXISTING workspace only happens for
 *     provider-verified emails. An unverified email must never be allowed to
 *     take over an account that was claimed via a verified magic link.
 */

import { sql } from "@/lib/lc-backend";

export type OAuthProvider = "google" | "github";

export function isOAuthProvider(s: string): s is OAuthProvider {
  return s === "google" || s === "github";
}

type ProviderConfig = {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
};

/** Returns the provider's config, or null when its env vars aren't set. */
export function providerConfig(provider: OAuthProvider): ProviderConfig | null {
  if (provider === "google") {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    return {
      clientId,
      clientSecret,
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scope: "openid email profile",
    };
  }
  // github
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scope: "read:user user:email",
  };
}

/** Which providers are wired up — drives which buttons the dashboard shows. */
export function configuredProviders(): Record<OAuthProvider, boolean> {
  return {
    google: !!providerConfig("google"),
    github: !!providerConfig("github"),
  };
}

/** The redirect_uri that must be registered in the provider's OAuth app. */
export function redirectUri(origin: string, provider: OAuthProvider): string {
  return `${origin}/api/lc/auth/oauth/${provider}/callback`;
}

export function buildAuthorizeUrl(
  provider: OAuthProvider,
  cfg: ProviderConfig,
  origin: string,
  state: string,
): string {
  const u = new URL(cfg.authorizeUrl);
  u.searchParams.set("client_id", cfg.clientId);
  u.searchParams.set("redirect_uri", redirectUri(origin, provider));
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", cfg.scope);
  u.searchParams.set("state", state);
  if (provider === "google") {
    u.searchParams.set("access_type", "online");
    u.searchParams.set("prompt", "select_account");
  } else {
    u.searchParams.set("allow_signup", "true");
  }
  return u.toString();
}

export type OAuthIdentity = {
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
};

/** code → access token → normalized identity. Throws on any failure. */
export async function exchangeCodeForIdentity(
  provider: OAuthProvider,
  cfg: ProviderConfig,
  origin: string,
  code: string,
): Promise<OAuthIdentity> {
  const tokenRes = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(origin, provider),
    }),
  });
  if (!tokenRes.ok) throw new Error(`token_exchange_failed_${tokenRes.status}`);
  const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string };
  const accessToken = tokenJson.access_token;
  if (!accessToken) throw new Error(tokenJson.error || "no_access_token");

  if (provider === "google") {
    const r = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) throw new Error(`userinfo_failed_${r.status}`);
    const u = (await r.json()) as {
      sub: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
    };
    return {
      subject: String(u.sub),
      email: u.email ? u.email.toLowerCase() : null,
      emailVerified: !!u.email_verified,
      name: u.name ?? null,
    };
  }

  // github — basic profile, then the primary verified email
  const ghHeaders = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "LemonCake",
  };
  const userRes = await fetch("https://api.github.com/user", { headers: ghHeaders });
  if (!userRes.ok) throw new Error(`user_failed_${userRes.status}`);
  const gu = (await userRes.json()) as {
    id: number;
    login: string;
    name?: string | null;
    email?: string | null;
  };

  let email: string | null = gu.email ? gu.email.toLowerCase() : null;
  let emailVerified = false;
  try {
    const eRes = await fetch("https://api.github.com/user/emails", { headers: ghHeaders });
    if (eRes.ok) {
      const emails = (await eRes.json()) as { email: string; primary: boolean; verified: boolean }[];
      const chosen = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified);
      if (chosen) {
        email = chosen.email.toLowerCase();
        emailVerified = true;
      }
    }
  } catch {
    /* fall back to the (unverified) public profile email */
  }

  return {
    subject: String(gu.id),
    email,
    emailVerified,
    name: gu.name ?? gu.login ?? null,
  };
}

async function linkIdentity(
  provider: OAuthProvider,
  subject: string,
  ownerId: string,
  email: string | null,
): Promise<void> {
  await sql()`
    insert into lc_oauth_identities (provider, subject, owner_id, email)
    values (${provider}, ${subject}, ${ownerId}, ${email})
    on conflict (provider, subject) do nothing
  `;
}

/**
 * Resolve an OAuth identity to an owner id. Mirrors the magic-link verify
 * logic but keyed on (provider, subject):
 *
 *   1. Known identity              → that owner (login).
 *   2. Verified email owns a row   → link this identity to it.
 *   3. Anonymous cookie owner      → claim it.
 *   4. Otherwise                   → create a fresh owner.
 *
 * Email is only written onto an owner when the provider verified it, and
 * an owner's existing email is never overwritten.
 */
export async function resolveOwnerForOAuth(args: {
  provider: OAuthProvider;
  identity: OAuthIdentity;
  prevOwnerId: string | null;
}): Promise<string> {
  const { provider, identity, prevOwnerId } = args;
  const { subject, email, emailVerified } = identity;
  const verifiedEmail = email && emailVerified ? email : null;

  // 1. Returning identity.
  const byIdentity = await sql()<{ owner_id: string }[]>`
    select owner_id from lc_oauth_identities
    where provider = ${provider} and subject = ${subject} limit 1
  `;
  if (byIdentity.length > 0) {
    const ownerId = byIdentity[0].owner_id;
    if (verifiedEmail) {
      await sql()`
        update lc_owners set email = ${verifiedEmail}, email_verified_at = now()
        where id = ${ownerId} and email is null
      `;
    }
    return ownerId;
  }

  // 2. Verified email already owns a workspace → attach this identity.
  if (verifiedEmail) {
    const byEmail = await sql()<{ id: string }[]>`
      select id from lc_owners where email = ${verifiedEmail} limit 1
    `;
    if (byEmail.length > 0) {
      await linkIdentity(provider, subject, byEmail[0].id, verifiedEmail);
      return byEmail[0].id;
    }
  }

  // 3. Claim the anonymous cookie owner, if present.
  if (prevOwnerId) {
    await sql()`insert into lc_owners (id) values (${prevOwnerId}) on conflict (id) do nothing`;
    if (verifiedEmail) {
      await sql()`
        update lc_owners set email = ${verifiedEmail}, email_verified_at = now()
        where id = ${prevOwnerId} and email is null
      `;
    }
    await linkIdentity(provider, subject, prevOwnerId, email);
    return prevOwnerId;
  }

  // 4. Fresh owner.
  const newId = `o_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  if (verifiedEmail) {
    await sql()`insert into lc_owners (id, email, email_verified_at) values (${newId}, ${verifiedEmail}, now())`;
  } else {
    await sql()`insert into lc_owners (id) values (${newId})`;
  }
  await linkIdentity(provider, subject, newId, email);
  return newId;
}

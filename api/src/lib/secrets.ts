/**
 * Secrets bootstrap & validation.
 *
 * We currently use environment variables (Railway / GitHub Actions / `.env`).
 * Migration to GCP Secret Manager / AWS Secrets Manager / HashiCorp Vault
 * is tracked in C-01 of the 2026-05 @kleosr audit.
 *
 * Until then, this file does the next-best thing: a hard validation step
 * at process start so the API refuses to boot in production with a missing
 * or obviously-weak wallet key. That alone wouldn't have caught the audit
 * finding (the keys are still in env vars), but it stops a class of
 * configuration mistakes — empty key, default key, or a private key that
 * accidentally got committed to the wrong env file.
 */

const REQUIRED_IN_PRODUCTION = [
  "HOT_WALLET_PRIVATE_KEY",
  "TREASURY_WALLET_PRIVATE_KEY",
  "JWT_SECRET",
  "ADMIN_JWT_SECRET",
  "INCIDENT_SIGNING_KEY",
  "ACCOUNTING_TOKEN_SECRET",
];

const KNOWN_BAD_VALUES = new Set([
  "",
  "changeme",
  "change-me",
  "dev",
  "dev-key",
  "dev-admin-key",
  "insecure-dev-key-change-me",
  "skyfire-dev-secret-change-in-prod",
  "test",
  "test-key",
  "secret",
  "password",
]);

function isPlausiblyWeak(value: string): string | null {
  if (!value) return "empty value";
  if (KNOWN_BAD_VALUES.has(value.trim().toLowerCase()))
    return `known-bad placeholder value (${value.slice(0, 6)}…)`;
  if (value.length < 32)
    return `shorter than 32 characters (got ${value.length})`;
  return null;
}

/**
 * Validate that critical secrets are set to plausibly-real values.
 * In production this throws (and the process should exit non-zero).
 * In development it logs warnings but does not crash.
 */
export function validateSecretsOrThrow(): void {
  const isProd = process.env.NODE_ENV === "production";
  const problems: string[] = [];

  for (const name of REQUIRED_IN_PRODUCTION) {
    const v = process.env[name];
    if (v === undefined) {
      problems.push(`${name}: not set`);
      continue;
    }
    const issue = isPlausiblyWeak(v);
    if (issue) problems.push(`${name}: ${issue}`);
  }

  // Private keys deserve an extra check — they should be 0x + 64 hex chars
  // for raw EVM keys, or a base64/base58 string for Solana. We just check
  // length here; deeper format checks happen when the wallet libraries try
  // to use them.
  for (const name of ["HOT_WALLET_PRIVATE_KEY", "TREASURY_WALLET_PRIVATE_KEY"]) {
    const v = process.env[name];
    if (v && v.length < 64) {
      problems.push(
        `${name}: looks too short to be a real private key (${v.length} chars)`
      );
    }
  }

  if (problems.length === 0) return;

  const header = "[Secrets] validation failed:";
  const body = problems.map((p) => `  - ${p}`).join("\n");
  const msg = `${header}\n${body}`;

  if (isProd) {
    // eslint-disable-next-line no-console
    console.error(msg);
    throw new Error(
      "Secrets validation failed in production. Fix the values above and redeploy."
    );
  }
  // eslint-disable-next-line no-console
  console.warn(msg);
  // eslint-disable-next-line no-console
  console.warn(
    "[Secrets] Continuing in non-production mode. This would refuse to boot in NODE_ENV=production."
  );
}

/**
 * Legacy bootstrap entrypoint. Kept for backward compatibility with
 * existing call sites; calls into the new validator.
 */
export async function loadSecretsFromGCP(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log("[Secrets] Using environment variables (validating…)");
  validateSecretsOrThrow();
}

// Shared STS host helper aligned with Go/Java/PHP/Python SDKs.
//
// The default_sts_host_for(region) helper is used by all STS-based providers
// (StsAssumeRole, OIDC, SAML) so the region drives the STS host when no
// explicit host is supplied.
//
// Rules (mirroring Go `defaultSTSHostFor` in
// byteplus-go-sdk-v2/byteplus/credentials/sts_credentials.go):
//   1. Normalize region via `trim().toLowerCase()`.
//   2. Empty region falls back to DEFAULT_STS_REGION ("ap-southeast-1").
//   3. cn-prefixed mainland regions use the `.byteplusapi.com.cn` suffix.
//   4. cn-hongkong is on the non-mainland whitelist and stays on
//      `.byteplusapi.com` (the international suffix).

export const DEFAULT_STS_REGION = "ap-southeast-1";
export const DEFAULT_STS_ENDPOINT = `sts.${DEFAULT_STS_REGION}.byteplusapi.com`;

const cnNonMainlandRegionSet: Record<string, true> = {
  "cn-hongkong": true,
};

export function defaultSTSHostFor(region: string | undefined | null): string {
  let normalized = (region ?? "").trim().toLowerCase();
  if (normalized === "") {
    normalized = DEFAULT_STS_REGION;
  }
  let suffix = "byteplusapi.com";
  if (normalized.startsWith("cn-") && !cnNonMainlandRegionSet[normalized]) {
    suffix = "byteplusapi.com.cn";
  }
  return `sts.${normalized}.${suffix}`;
}

/**
 * resolveStsEndpoint implements the three-level fallback used by
 * OidcCredentialProvider and SamlCredentialProvider:
 *   Level 1: explicit `host` argument (highest priority).
 *   Level 2: non-empty `region` -> defaultSTSHostFor(region).
 *   Level 3: DEFAULT_STS_ENDPOINT.
 */
export function resolveStsEndpoint(
  host: string | undefined | null,
  region: string | undefined | null,
): string {
  if (host && host.trim() !== "") {
    return host;
  }
  const normalizedRegion = (region ?? "").trim();
  if (normalizedRegion !== "") {
    return defaultSTSHostFor(normalizedRegion);
  }
  return DEFAULT_STS_ENDPOINT;
}

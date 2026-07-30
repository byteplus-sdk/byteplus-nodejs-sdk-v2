// Cross-language endpoint addressing aligned with Go/Java/PHP/Python SDKs.
// Implements the ServiceEndpointInfo(isGlobal, goChinaEnabled) decision table.

import { loadEnv } from "./env";

export interface ServiceEndpointInfo {
  Service: string;
  IsGlobal: boolean;
  GoChinaEnabled: boolean;
}

const separator = ".";
const openPrefix = "open";
const byteplusEndpointSuffix = separator + "byteplusapi.com";
const dualstackEndpointSuffix = separator + "byteplus-api.com";
const cnSuffix = separator + "cn";
const regionCodeCNHongKong = "cn-hongkong";

const endpoint = openPrefix + separator + "ap-southeast-1" + byteplusEndpointSuffix;

// cnNonMainlandRegionSet lists cn-prefixed regions that keep the international
// .com suffix rather than the mainland .com.cn suffix.
const cnNonMainlandRegionSet: Record<string, true> = {
  [regionCodeCNHongKong]: true,
};

const defaultEndpoint: Record<string, ServiceEndpointInfo> = {
  vpc: { Service: "vpc", IsGlobal: false, GoChinaEnabled: true },
  vke: { Service: "vke", IsGlobal: false, GoChinaEnabled: true },
  auto_scaling: { Service: "auto_scaling", IsGlobal: false, GoChinaEnabled: true },
  storage_ebs: { Service: "storage_ebs", IsGlobal: false, GoChinaEnabled: true },
  vedbm: { Service: "vedbm", IsGlobal: false, GoChinaEnabled: true },
  privatelink: { Service: "privatelink", IsGlobal: false, GoChinaEnabled: true },
  clb: { Service: "clb", IsGlobal: false, GoChinaEnabled: true },
  transitrouter: { Service: "transitrouter", IsGlobal: false, GoChinaEnabled: true },
  directconnect: { Service: "directconnect", IsGlobal: false, GoChinaEnabled: true },
  vpn: { Service: "vpn", IsGlobal: false, GoChinaEnabled: true },
  natgateway: { Service: "natgateway", IsGlobal: false, GoChinaEnabled: true },
  rds_mysql: { Service: "rds_mysql", IsGlobal: false, GoChinaEnabled: true },
  smc: { Service: "smc", IsGlobal: true, GoChinaEnabled: false },
  iam: { Service: "iam", IsGlobal: true, GoChinaEnabled: true },
  vepfs: { Service: "vepfs", IsGlobal: false, GoChinaEnabled: true },
  kms: { Service: "kms", IsGlobal: false, GoChinaEnabled: true },
  ecs: { Service: "ecs", IsGlobal: false, GoChinaEnabled: true },
  mongodb: { Service: "mongodb", IsGlobal: false, GoChinaEnabled: true },
  private_zone: { Service: "private_zone", IsGlobal: true, GoChinaEnabled: true },
  rds_postgresql: { Service: "rds_postgresql", IsGlobal: false, GoChinaEnabled: true },
  resource_share: { Service: "resource_share", IsGlobal: true, GoChinaEnabled: false },
  vmp: { Service: "vmp", IsGlobal: false, GoChinaEnabled: true },
  tag: { Service: "tag", IsGlobal: true, GoChinaEnabled: false },
  cr: { Service: "cr", IsGlobal: false, GoChinaEnabled: true },
  alb: { Service: "alb", IsGlobal: false, GoChinaEnabled: true },
  sts: { Service: "sts", IsGlobal: false, GoChinaEnabled: true },
  hbase: { Service: "hbase", IsGlobal: false, GoChinaEnabled: true },
  rds_mssql: { Service: "rds_mssql", IsGlobal: false, GoChinaEnabled: true },
  ml_platform: { Service: "ml_platform", IsGlobal: false, GoChinaEnabled: false },
  apig: { Service: "apig", IsGlobal: false, GoChinaEnabled: false },
  ark: { Service: "ark", IsGlobal: false, GoChinaEnabled: false },
  waf: { Service: "waf", IsGlobal: true, GoChinaEnabled: false },
  quota: { Service: "quota", IsGlobal: true, GoChinaEnabled: false },
  dms: { Service: "dms", IsGlobal: false, GoChinaEnabled: true },
  vefaas: { Service: "vefaas", IsGlobal: false, GoChinaEnabled: false },
  cen: { Service: "cen", IsGlobal: true, GoChinaEnabled: false },
  cp: { Service: "cp", IsGlobal: false, GoChinaEnabled: false },
  cloudmonitor: { Service: "cloudmonitor", IsGlobal: false, GoChinaEnabled: true },
  eco_partner: { Service: "eco_partner", IsGlobal: true, GoChinaEnabled: false },
  milvus: { Service: "milvus", IsGlobal: false, GoChinaEnabled: false },
  llmshield: { Service: "llmshield", IsGlobal: false, GoChinaEnabled: false },
  billing: { Service: "billing", IsGlobal: true, GoChinaEnabled: true },
  id: { Service: "id", IsGlobal: false, GoChinaEnabled: false },
  clawsentry: { Service: "clawsentry", IsGlobal: false, GoChinaEnabled: false },
  resourcecenter: { Service: "resourcecenter", IsGlobal: true, GoChinaEnabled: false },
  escloud: { Service: "escloud", IsGlobal: false, GoChinaEnabled: false },
  cpaas: { Service: "cpaas", IsGlobal: true, GoChinaEnabled: false },
  filenas: { Service: "filenas", IsGlobal: false, GoChinaEnabled: true },
  kafka: { Service: "kafka", IsGlobal: false, GoChinaEnabled: true },
  kickart: { Service: "kickart", IsGlobal: true, GoChinaEnabled: false },
  rabbitmq: { Service: "rabbitmq", IsGlobal: false, GoChinaEnabled: false },
  redis: { Service: "redis", IsGlobal: false, GoChinaEnabled: true },
  vod: { Service: "vod", IsGlobal: false, GoChinaEnabled: false },
  vs: { Service: "vs", IsGlobal: true, GoChinaEnabled: false },
};

/** ServiceEndpointInfoMissingError is thrown when the service is not registered
 * in the default endpoint map. Aligned with Go's ErrServiceEndpointInfoMissing
 * and Python's ServiceEndpointInfoMissingError. */
export class ServiceEndpointInfoMissingError extends Error {
  readonly service: string;
  constructor(service: string) {
    super(
      `byteplus-sdk: service endpoint info missing: service '${service}' not registered`,
    );
    this.name = "ServiceEndpointInfoMissingError";
    this.service = service;
  }
}

function standardizeDomainServiceCode(serviceCode: string): string {
  return serviceCode.toLowerCase().replace(/_/g, "-");
}

function normalizeRegion(regionCode: string | undefined | null): string {
  if (!regionCode) return "";
  return regionCode.trim().toLowerCase();
}

function isCnRegion(normalizedRegion: string): boolean {
  if (!normalizedRegion.startsWith("cn-")) {
    return false;
  }
  return !cnNonMainlandRegionSet[normalizedRegion];
}

function hasEnableDualStack(useDualStack?: boolean): boolean {
  if (useDualStack === undefined) {
    return Boolean(loadEnv().enableDualstack);
  }
  return useDualStack;
}

/**
 * resolveDefaultEndpoint is the SDK-internal entry point mirroring Go's
 * ResolveDefaultEndpoint. It consults the defaultEndpoint map and combines
 * IsGlobal + GoChinaEnabled + normalized region to produce a deterministic
 * {service}[.{region}].byteplusapi.com[.cn] endpoint.
 *
 * Throws ServiceEndpointInfoMissingError when service is not registered.
 */
export function resolveDefaultEndpoint(
  service: string,
  regionCode: string,
  useDualStack?: boolean,
): string {
  const info = defaultEndpoint[service];
  if (!info) {
    throw new ServiceEndpointInfoMissingError(service);
  }

  const normalizedRegion = normalizeRegion(regionCode);

  let baseSuffix = byteplusEndpointSuffix;
  if (hasEnableDualStack(useDualStack)) {
    baseSuffix = dualstackEndpointSuffix;
  }

  const useCN = info.GoChinaEnabled && isCnRegion(normalizedRegion);
  const suffix = useCN ? baseSuffix + cnSuffix : baseSuffix;

  const svc = standardizeDomainServiceCode(service);
  if (info.IsGlobal) {
    return svc + suffix;
  }
  return svc + separator + normalizedRegion + suffix;
}

/**
 * getDefaultEndpointByServiceInfo is the backwards-compatible entry point that
 * preserves the original signature. Delegates to resolveDefaultEndpoint; if the
 * service is not registered, falls back to the default open endpoint so existing
 * call sites do not crash.
 */
export function getDefaultEndpointByServiceInfo(
  service: string,
  regionCode: string,
  useDualStack?: boolean,
): string {
  // Unregistered service: fall back to the default open endpoint (historical
  // behavior) instead of letting resolveDefaultEndpoint fail-fast.
  if (!defaultEndpoint[service]) {
    return endpoint;
  }
  try {
    return resolveDefaultEndpoint(service, regionCode, useDualStack);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      `byteplus-sdk: failed to resolve endpoint for service '${service}' in region '${regionCode}': ${reason}`,
    );
  }
}

export { endpoint as defaultOpenEndpoint };

/** Test-only escape hatch: exposes the internal `defaultEndpoint` map so unit
 * tests can temporarily register / unregister synthetic services, mirroring
 * Go's `registerTestService` helper. Do not import from production code. */
export const __test_defaultEndpoint = defaultEndpoint;

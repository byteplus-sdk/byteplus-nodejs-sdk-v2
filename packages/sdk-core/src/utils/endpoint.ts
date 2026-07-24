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
  ecs: { Service: "ecs", IsGlobal: false, GoChinaEnabled: true },
  billing: { Service: "billing", IsGlobal: true, GoChinaEnabled: true },
  ark: { Service: "ark", IsGlobal: false, GoChinaEnabled: true },
  iam: { Service: "iam", IsGlobal: true, GoChinaEnabled: true },
  mcs: { Service: "mcs", IsGlobal: false, GoChinaEnabled: true },
  rocketmq: { Service: "rocketmq", IsGlobal: false, GoChinaEnabled: true },
  bytehouse: { Service: "bytehouse", IsGlobal: false, GoChinaEnabled: true },
  dns: { Service: "dns", IsGlobal: true, GoChinaEnabled: true },
  autoscaling: { Service: "autoscaling", IsGlobal: false, GoChinaEnabled: true },
  spark: { Service: "spark", IsGlobal: false, GoChinaEnabled: true },
  cloud_detect: { Service: "cloud_detect", IsGlobal: false, GoChinaEnabled: true },
  filenas: { Service: "filenas", IsGlobal: false, GoChinaEnabled: true },
  escloud: { Service: "escloud", IsGlobal: false, GoChinaEnabled: true },
  flink: { Service: "flink", IsGlobal: false, GoChinaEnabled: true },
  cp: { Service: "cp", IsGlobal: false, GoChinaEnabled: true },
  vefaas: { Service: "vefaas", IsGlobal: false, GoChinaEnabled: true },
  ml_platform: { Service: "ml_platform", IsGlobal: false, GoChinaEnabled: true },
  edx: { Service: "edx", IsGlobal: true, GoChinaEnabled: true },
  dcdn: { Service: "dcdn", IsGlobal: true, GoChinaEnabled: true },
  cdn: { Service: "cdn", IsGlobal: true, GoChinaEnabled: true },
  kafka: { Service: "kafka", IsGlobal: false, GoChinaEnabled: true },
  certificate_service: { Service: "certificate_service", IsGlobal: true, GoChinaEnabled: true },
  waf: { Service: "waf", IsGlobal: true, GoChinaEnabled: true },
  rds_mssql: { Service: "rds_mssql", IsGlobal: false, GoChinaEnabled: true },
  cloudtrail: { Service: "cloudtrail", IsGlobal: false, GoChinaEnabled: true },
  vei_api: { Service: "vei_api", IsGlobal: true, GoChinaEnabled: true },
  cen: { Service: "cen", IsGlobal: true, GoChinaEnabled: true },
  rabbitmq: { Service: "rabbitmq", IsGlobal: false, GoChinaEnabled: true },
  vmp: { Service: "vmp", IsGlobal: false, GoChinaEnabled: true },
  volc_observe: { Service: "volc_observe", IsGlobal: false, GoChinaEnabled: true },
  dataleap: { Service: "dataleap", IsGlobal: false, GoChinaEnabled: true },
  fw_center: { Service: "fw_center", IsGlobal: true, GoChinaEnabled: true },
  redis: { Service: "redis", IsGlobal: false, GoChinaEnabled: true },
  mcdn: { Service: "mcdn", IsGlobal: true, GoChinaEnabled: true },
  cloudidentity: { Service: "cloudidentity", IsGlobal: false, GoChinaEnabled: true },
  vedbm: { Service: "vedbm", IsGlobal: false, GoChinaEnabled: true },
  cv: { Service: "cv", IsGlobal: true, GoChinaEnabled: true },
  translate: { Service: "translate", IsGlobal: true, GoChinaEnabled: true },
  cloud_trail: { Service: "cloud_trail", IsGlobal: false, GoChinaEnabled: true },
  bio: { Service: "bio", IsGlobal: false, GoChinaEnabled: true },
  nta: { Service: "nta", IsGlobal: true, GoChinaEnabled: true },
  elasticmapreduce: { Service: "elasticmapreduce", IsGlobal: false, GoChinaEnabled: true },
  vepfs: { Service: "vepfs", IsGlobal: false, GoChinaEnabled: true },
  seccenter: { Service: "seccenter", IsGlobal: true, GoChinaEnabled: true },
  advdefence: { Service: "advdefence", IsGlobal: true, GoChinaEnabled: true },
  tis: { Service: "tis", IsGlobal: true, GoChinaEnabled: true },
  organization: { Service: "organization", IsGlobal: true, GoChinaEnabled: true },
  vke: { Service: "vke", IsGlobal: false, GoChinaEnabled: true },
  Redis: { Service: "Redis", IsGlobal: false, GoChinaEnabled: true },
  privatelink: { Service: "privatelink", IsGlobal: false, GoChinaEnabled: true },
  RocketMQ: { Service: "RocketMQ", IsGlobal: false, GoChinaEnabled: true },
  Kafka: { Service: "Kafka", IsGlobal: false, GoChinaEnabled: true },
  rds_mysql: { Service: "rds_mysql", IsGlobal: false, GoChinaEnabled: true },
  rds_postgresql: { Service: "rds_postgresql", IsGlobal: false, GoChinaEnabled: true },
  storage_ebs: { Service: "storage_ebs", IsGlobal: false, GoChinaEnabled: true },
  clb: { Service: "clb", IsGlobal: false, GoChinaEnabled: true },
  alb: { Service: "alb", IsGlobal: false, GoChinaEnabled: true },
  FileNAS: { Service: "FileNAS", IsGlobal: false, GoChinaEnabled: true },
  configcenter: { Service: "configcenter", IsGlobal: false, GoChinaEnabled: true },
  cr: { Service: "cr", IsGlobal: false, GoChinaEnabled: true },
  sts: { Service: "sts", IsGlobal: false, GoChinaEnabled: true },
  mongodb: { Service: "mongodb", IsGlobal: false, GoChinaEnabled: true },
  transitrouter: { Service: "transitrouter", IsGlobal: false, GoChinaEnabled: true },
  Volc_Observe: { Service: "Volc_Observe", IsGlobal: false, GoChinaEnabled: true },
  dms: { Service: "dms", IsGlobal: false, GoChinaEnabled: true },
  auto_scaling: { Service: "auto_scaling", IsGlobal: false, GoChinaEnabled: true },
  directconnect: { Service: "directconnect", IsGlobal: false, GoChinaEnabled: true },
  kms: { Service: "kms", IsGlobal: false, GoChinaEnabled: true },
  dbw: { Service: "dbw", IsGlobal: false, GoChinaEnabled: true },
  dts: { Service: "dts", IsGlobal: false, GoChinaEnabled: true },
  natgateway: { Service: "natgateway", IsGlobal: false, GoChinaEnabled: true },
  tos: { Service: "tos", IsGlobal: false, GoChinaEnabled: true },
  TLS: { Service: "TLS", IsGlobal: false, GoChinaEnabled: true },
  vpn: { Service: "vpn", IsGlobal: false, GoChinaEnabled: true },
  vod: { Service: "vod", IsGlobal: false, GoChinaEnabled: true },
  quota: { Service: "quota", IsGlobal: true, GoChinaEnabled: true },
  ecs_ops: { Service: "ecs_ops", IsGlobal: true, GoChinaEnabled: true },
  as_ops: { Service: "as_ops", IsGlobal: true, GoChinaEnabled: true },
  account_management: { Service: "account_management", IsGlobal: true, GoChinaEnabled: true },
  account_management_byteplus: { Service: "account_management_byteplus", IsGlobal: true, GoChinaEnabled: true },
  bandwidthquota: { Service: "bandwidthquota", IsGlobal: true, GoChinaEnabled: true },
  psa_manager: { Service: "psa_manager", IsGlobal: true, GoChinaEnabled: true },
  dc_controller: { Service: "dc_controller", IsGlobal: false, GoChinaEnabled: true },
  eps_platform_trade: { Service: "eps_platform_trade", IsGlobal: false, GoChinaEnabled: true },
  eps_platform_fund: { Service: "eps_platform_fund", IsGlobal: false, GoChinaEnabled: true },
  commercialization: { Service: "commercialization", IsGlobal: true, GoChinaEnabled: true },
  veecp_openapi: { Service: "veecp_openapi", IsGlobal: false, GoChinaEnabled: true },
  orgnization: { Service: "orgnization", IsGlobal: true, GoChinaEnabled: true },
  coze: { Service: "coze", IsGlobal: true, GoChinaEnabled: true },
  sec_agent: { Service: "sec_agent", IsGlobal: true, GoChinaEnabled: true },
  sec_intelligent_dev: { Service: "sec_intelligent_dev", IsGlobal: true, GoChinaEnabled: true },
  vegame: { Service: "vegame", IsGlobal: false, GoChinaEnabled: true },
  acep: { Service: "acep", IsGlobal: true, GoChinaEnabled: true },
  private_zone: { Service: "private_zone", IsGlobal: true, GoChinaEnabled: true },
  sqs: { Service: "sqs", IsGlobal: false, GoChinaEnabled: true },
  resourcecenter: { Service: "resourcecenter", IsGlobal: true, GoChinaEnabled: true },
  aiotvideo: { Service: "aiotvideo", IsGlobal: true, GoChinaEnabled: true },
  apig: { Service: "apig", IsGlobal: false, GoChinaEnabled: true },
  bmq: { Service: "bmq", IsGlobal: false, GoChinaEnabled: true },
  bytehouse_ce: { Service: "bytehouse_ce", IsGlobal: false, GoChinaEnabled: true },
  cloudmonitor: { Service: "cloudmonitor", IsGlobal: false, GoChinaEnabled: true },
  emr: { Service: "emr", IsGlobal: false, GoChinaEnabled: true },
  ga: { Service: "ga", IsGlobal: true, GoChinaEnabled: true },
  graph: { Service: "graph", IsGlobal: false, GoChinaEnabled: true },
  gtm: { Service: "gtm", IsGlobal: true, GoChinaEnabled: true },
  hbase: { Service: "hbase", IsGlobal: false, GoChinaEnabled: true },
  metakms: { Service: "metakms", IsGlobal: false, GoChinaEnabled: true },
  na: { Service: "na", IsGlobal: true, GoChinaEnabled: true },
  resource_share: { Service: "resource_share", IsGlobal: true, GoChinaEnabled: true },
  speech_saas_prod: { Service: "speech_saas_prod", IsGlobal: true, GoChinaEnabled: true },
  tag: { Service: "tag", IsGlobal: true, GoChinaEnabled: true },
  vefaas_dev: { Service: "vefaas_dev", IsGlobal: false, GoChinaEnabled: true },
  vms: { Service: "vms", IsGlobal: false, GoChinaEnabled: true },
  eco_partner: { Service: "eco_partner", IsGlobal: true, GoChinaEnabled: true },
  smc: { Service: "smc", IsGlobal: true, GoChinaEnabled: true },
  cpaas: { Service: "cpaas", IsGlobal: true, GoChinaEnabled: true },
  kickart: { Service: "kickart", IsGlobal: true, GoChinaEnabled: true },
  vs: { Service: "vs", IsGlobal: true, GoChinaEnabled: true },
  i18n_openapi: { Service: "i18n_openapi", IsGlobal: true, GoChinaEnabled: true },
  arkclaw: { Service: "arkclaw", IsGlobal: false, GoChinaEnabled: true },
  insight: { Service: "insight", IsGlobal: true, GoChinaEnabled: true },
  cbr: { Service: "cbr", IsGlobal: false, GoChinaEnabled: true },
  config: { Service: "config", IsGlobal: true, GoChinaEnabled: true },
  milvus: { Service: "milvus", IsGlobal: false, GoChinaEnabled: true },
  partner: { Service: "partner", IsGlobal: true, GoChinaEnabled: true },
  clawsentry: { Service: "clawsentry", IsGlobal: false, GoChinaEnabled: true },
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
 * inBootstrapRegionList is retained for API compatibility with older callers.
 * The default addressing pipeline no longer consults it. Always returns false.
 *
 * @deprecated Bootstrap-region-based routing has been removed from the default
 * addressing pipeline. Prefer explicit `host` or the default resolver.
 */
export function inBootstrapRegionList(
  _regionCode: string,
  _customBootstrapRegion?: Record<string, unknown>,
): boolean {
  return false;
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
 * service is not registered, returns null so existing call sites do not crash
 * (the caller is expected to fall back to explicit host configuration).
 *
 * @deprecated `customBootstrapRegion` is retained for API compatibility only
 * and is ignored at runtime. New call sites should prefer resolveDefaultEndpoint.
 */
export function getDefaultEndpointByServiceInfo(
  service: string,
  regionCode: string,
  _customBootstrapRegion?: Record<string, unknown>,
  useDualStack?: boolean,
): string | null {
  try {
    return resolveDefaultEndpoint(service, regionCode, useDualStack);
  } catch (err) {
    if (err instanceof ServiceEndpointInfoMissingError) {
      return endpoint;
    }
    throw err;
  }
}

export { endpoint as defaultOpenEndpoint };

/** Test-only escape hatch: exposes the internal `defaultEndpoint` map so unit
 * tests can temporarily register / unregister synthetic services, mirroring
 * Go's `registerTestService` helper. Do not import from production code. */
export const __test_defaultEndpoint = defaultEndpoint;

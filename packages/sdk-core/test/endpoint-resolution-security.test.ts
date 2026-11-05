import * as fs from "fs";
import * as path from "path";
import {
  __test_defaultEndpoint,
  getDefaultEndpointByServiceInfo,
  resolveDefaultEndpoint,
} from "../src/utils/endpoint";
import { endpointMiddleware } from "../src/middlewares/endpoint";
import { EndpointValidationError, validateServiceAndRegion } from "../src/utils/endpoint-validation";
import * as envUtils from "../src/utils/env";
import { Field, codeOf, invalidCases, messageOf, validLabels } from "./endpoint-security-cases";

const SRC_ROOT = path.resolve(__dirname, "../src");
const REPO_ROOT = path.resolve(__dirname, "../../..");

function generatedServiceNames(): string[] {
  const serviceRoot = path.join(REPO_ROOT, "service");
  const names = new Set<string>();
  for (const dir of fs.readdirSync(serviceRoot)) {
    const api = path.join(serviceRoot, dir, "src", "api.ts");
    if (!fs.existsSync(api)) continue;
    for (const m of fs.readFileSync(api, "utf8").matchAll(/metaPath = '\/[^/]+\/[^/]+\/([^/]+)\//g)) {
      names.add(m[1]);
    }
  }
  return [...names];
}

function builtinDefaultRegions(): string[] {
  const regions = new Set<string>(["ap-southeast-1"]);
  const serviceRoot = path.join(REPO_ROOT, "service");
  for (const dir of fs.readdirSync(serviceRoot)) {
    for (const file of ["src/api.ts", "src/config.ts"]) {
      const p = path.join(serviceRoot, dir, file);
      if (!fs.existsSync(p)) continue;
      const src = fs.readFileSync(p, "utf8");
      for (const m of src.matchAll(/region: '([^']*)'/g)) regions.add(m[1]);
      for (const m of src.matchAll(/defaultRegion = "([^"]*)"/g)) regions.add(m[1]);
    }
  }
  const cli = fs.readFileSync(path.join(SRC_ROOT, "credentials/CLIConfigCredentialProvider.ts"), "utf8");
  for (const m of cli.matchAll(/DEFAULT_REGION = "([^"]+)"/g)) regions.add(m[1]);
  return [...regions];
}

const std = (s: string) => s.toLowerCase().replace(/_/g, "-");

// 按 byteplus 寻址规则重算期望 host，仅用于确认加校验后合法输入的寻址结果不变；
// 寻址规则本身由下方硬编码期望值的用例独立校验。
function expectedHost(service: string, region: string, dual: boolean): string {
  const info = __test_defaultEndpoint[service];
  const base = dual ? ".byteplus-api.com" : ".byteplusapi.com";
  if (!info) return "open.ap-southeast-1.byteplusapi.com";
  const r = region.toLowerCase();
  const cn = info.GoChinaEnabled && r.startsWith("cn-") && r !== "cn-hongkong";
  const suffix = cn ? base + ".cn" : base;
  return info.IsGlobal ? std(service) + suffix : `${std(service)}.${r}${suffix}`;
}

function expectInvalid(fn: () => unknown, field: Field, quoted: string, reason: string) {
  let err: unknown;
  try {
    fn();
  } catch (e) {
    err = e;
  }
  expect(err).toBeInstanceOf(EndpointValidationError);
  expect((err as EndpointValidationError).code).toBe(codeOf(field));
  expect((err as EndpointValidationError).message).toBe(messageOf(field, quoted, reason));
}

describe("default endpoint generation", () => {
  let loadEnv: jest.SpyInstance;
  beforeEach(() => {
    loadEnv = jest.spyOn(envUtils, "loadEnv").mockReturnValue({ credentials: {}, enableDualstack: false });
  });
  afterEach(() => jest.restoreAllMocks());

  describe.each([
    ["regional", "ecs", false],
    ["global", "iam", false],
    ["china-enabled regional", "rds_mysql", false],
    ["unknown service", "unknown_service", false],
    ["dualstack", "ecs", true],
    ["dualstack from env", "ecs", undefined],
  ] as const)("%s branch", (_, service, dual) => {
    test.each(invalidCases)("rejects region %j before any branch", (region, quoted, reason) => {
      expectInvalid(() => getDefaultEndpointByServiceInfo(service, region, dual), "region", quoted, reason);
      expect(loadEnv).not.toHaveBeenCalled();
    });

    test.each(invalidCases)("rejects service %j before any branch", (bad, quoted, reason) => {
      expectInvalid(() => getDefaultEndpointByServiceInfo(bad, "ap-southeast-1", dual), "service", quoted, reason);
      expect(loadEnv).not.toHaveBeenCalled();
    });
  });

  describe("resolveDefaultEndpoint", () => {
    test.each(invalidCases)("rejects region %j before the service lookup", (region, quoted, reason) => {
      expectInvalid(() => resolveDefaultEndpoint("unknown_service", region, false), "region", quoted, reason);
      expect(loadEnv).not.toHaveBeenCalled();
    });

    test.each(invalidCases)("rejects service %j before the service lookup", (bad, quoted, reason) => {
      expectInvalid(() => resolveDefaultEndpoint(bad, "cn-beijing", false), "service", quoted, reason);
    });
  });

  test("validation errors are not wrapped into a generic Error", () => {
    let err: unknown;
    try {
      getDefaultEndpointByServiceInfo("ecs", "cn-beijing.evil.com", false);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(EndpointValidationError);
    expect((err as Error).message).not.toContain("failed to resolve endpoint");
  });

  test.each([
    ["ecs", "ap-southeast-1", false, "ecs.ap-southeast-1.byteplusapi.com"],
    ["", "", false, "open.ap-southeast-1.byteplusapi.com"],
    ["ecs", "cn-beijing", false, "ecs.cn-beijing.byteplusapi.com.cn"],
    ["ecs", "CN-Beijing", false, "ecs.cn-beijing.byteplusapi.com.cn"],
    ["ecs", "cn-hongkong", false, "ecs.cn-hongkong.byteplusapi.com"],
    ["ark", "cn-beijing", false, "ark.cn-beijing.byteplusapi.com"],
    ["iam", "ap-southeast-1", false, "iam.byteplusapi.com"],
    ["iam", "cn-beijing", false, "iam.byteplusapi.com.cn"],
    ["tag", "cn-beijing", false, "tag.byteplusapi.com"],
    ["rds_mysql", "ap-southeast-3", true, "rds-mysql.ap-southeast-3.byteplus-api.com"],
    ["ecs", "cn-beijing", true, "ecs.cn-beijing.byteplus-api.com.cn"],
    ["iam", "cn-beijing", true, "iam.byteplus-api.com.cn"],
    ["unknown_service", "ap-southeast-1", false, "open.ap-southeast-1.byteplusapi.com"],
  ] as const)("keeps legal service=%j region=%j unchanged", (service, region, dual, host) => {
    expect(getDefaultEndpointByServiceInfo(service, region, dual)).toBe(host);
  });

  test("every built-in service and region passes and resolves to the original host", () => {
    const table = Object.entries(__test_defaultEndpoint);
    expect(table.length).toBeGreaterThan(40);
    const regions = ["ap-southeast-1", "ap-southeast-3", "cn-beijing", "cn-shanghai", "cn-hongkong"];
    for (const [key, info] of table) {
      expect(key).toBe(info.Service);
      for (const region of regions) {
        expect(() => validateServiceAndRegion(key, region)).not.toThrow();
        for (const dual of [false, true]) {
          expect(getDefaultEndpointByServiceInfo(key, region, dual)).toBe(expectedHost(key, region, dual));
        }
      }
    }
  });

  test("every generated service name and built-in default region passes validation", () => {
    const services = generatedServiceNames();
    expect(services.length).toBeGreaterThan(30);
    for (const service of [...services, "rds_mysql", "sts"]) {
      expect(() => validateServiceAndRegion(service, "")).not.toThrow();
    }
    for (const region of builtinDefaultRegions()) {
      expect(() => validateServiceAndRegion("", region)).not.toThrow();
    }
  });

  test.each(validLabels)("legal label %j never throws", (label) => {
    expect(() => getDefaultEndpointByServiceInfo(label, label, false)).not.toThrow();
  });
});

describe("endpointMiddleware", () => {
  beforeEach(() => {
    jest.spyOn(envUtils, "loadEnv").mockReturnValue({ credentials: {}, enableDualstack: false });
  });
  afterEach(() => jest.restoreAllMocks());

  const context = { clientName: "C", commandName: "X", clientConfig: {} } as any;

  test.each(invalidCases)("rejects region %j without calling next", async (region, quoted, reason) => {
    const next = jest.fn();
    const request: any = { region, serviceName: "ecs" };
    await expect(endpointMiddleware.middleware(next, context)({ request })).rejects.toMatchObject({
      code: "InvalidRegion",
      message: messageOf("region", quoted, reason),
    });
    expect(next).not.toHaveBeenCalled();
    expect(request.host).toBeUndefined();
  });

  test.each(invalidCases)("rejects service %j without calling next", async (service, quoted, reason) => {
    const next = jest.fn();
    const request: any = { region: "ap-southeast-1", serviceName: service };
    await expect(endpointMiddleware.middleware(next, context)({ request })).rejects.toMatchObject({
      code: "InvalidService",
      message: messageOf("service", quoted, reason),
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("does not validate when the host is explicitly set", async () => {
    const next = jest.fn(async (args: any) => args);
    const request: any = { host: "custom.example.com:8443", region: "cn@x", serviceName: "e/cs" };
    await endpointMiddleware.middleware(next, context)({ request });
    expect(next).toHaveBeenCalledTimes(1);
    expect(request.host).toBe("custom.example.com:8443");
  });
});

import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import {
  ServiceEndpointInfo,
  ServiceEndpointInfoMissingError,
  getDefaultEndpointByServiceInfo,
  resolveDefaultEndpoint,
  __test_defaultEndpoint as defaultEndpointMap,
} from "../src/utils/endpoint";
import * as envUtils from "../src/utils/env";

// Mirror Go/Java/PHP/Python decision table tests. Every branch of the
// (is_global x go_china_enabled x region) matrix is covered so a regression
// in the addressing logic is caught here.

jest.mock("../src/utils/env");

const mockLoadEnv = envUtils.loadEnv as jest.MockedFunction<
  typeof envUtils.loadEnv
>;

function useEnv(overrides: Partial<envUtils.EnvConfig> = {}) {
  mockLoadEnv.mockReturnValue({
    credentials: {},
    enableDualstack: false,
    ...overrides,
  } as envUtils.EnvConfig);
}

function withTempService<T>(info: ServiceEndpointInfo, fn: () => T): T {
  if (defaultEndpointMap[info.Service]) {
    throw new Error(
      `test service name '${info.Service}' collides with existing entry`,
    );
  }
  defaultEndpointMap[info.Service] = info;
  try {
    return fn();
  } finally {
    delete defaultEndpointMap[info.Service];
  }
}

describe("resolveDefaultEndpoint - decision table", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    useEnv();
  });

  const CASES: Array<{
    name: string;
    service: string;
    isGlobal: boolean;
    goChina: boolean;
    region: string;
    want: string;
  }> = [
    {
      name: "global gochina cn region uses cn suffix",
      service: "svc-global-gcn-cn",
      isGlobal: true,
      goChina: true,
      region: "cn-beijing",
      want: "svc-global-gcn-cn.byteplusapi.com.cn",
    },
    {
      name: "global gochina non-cn region drops cn suffix",
      service: "svc-global-gcn-non-cn",
      isGlobal: true,
      goChina: true,
      region: "ap-southeast-1",
      want: "svc-global-gcn-non-cn.byteplusapi.com",
    },
    {
      name: "global gochina disabled cn region stays international",
      service: "svc-global-nogcn-cn",
      isGlobal: true,
      goChina: false,
      region: "cn-beijing",
      want: "svc-global-nogcn-cn.byteplusapi.com",
    },
    {
      name: "global gochina disabled non-cn region stays international",
      service: "svc-global-nogcn-non-cn",
      isGlobal: true,
      goChina: false,
      region: "ap-southeast-1",
      want: "svc-global-nogcn-non-cn.byteplusapi.com",
    },
    {
      name: "regional gochina cn region uses cn suffix with region",
      service: "svc-regional-gcn-cn",
      isGlobal: false,
      goChina: true,
      region: "cn-beijing",
      want: "svc-regional-gcn-cn.cn-beijing.byteplusapi.com.cn",
    },
    {
      name: "regional gochina non-cn region keeps region without cn suffix",
      service: "svc-regional-gcn-non-cn",
      isGlobal: false,
      goChina: true,
      region: "ap-southeast-1",
      want: "svc-regional-gcn-non-cn.ap-southeast-1.byteplusapi.com",
    },
    {
      name: "regional gochina disabled cn region drops cn suffix",
      service: "svc-regional-nogcn-cn",
      isGlobal: false,
      goChina: false,
      region: "cn-beijing",
      want: "svc-regional-nogcn-cn.cn-beijing.byteplusapi.com",
    },
    {
      name: "regional gochina disabled non-cn region",
      service: "svc-regional-nogcn-non-cn",
      isGlobal: false,
      goChina: false,
      region: "ap-southeast-1",
      want: "svc-regional-nogcn-non-cn.ap-southeast-1.byteplusapi.com",
    },
  ];

  it("walks every branch of the decision table", () => {
    console.log(`=== TestResolveDefaultEndpoint_DecisionTable: ${CASES.length} cases ===`);
    const results: Array<[string, string]> = [];
    for (const c of CASES) {
      const info: ServiceEndpointInfo = {
        Service: c.service,
        IsGlobal: c.isGlobal,
        GoChinaEnabled: c.goChina,
      };
      const got = withTempService(info, () =>
        resolveDefaultEndpoint(c.service, c.region),
      );
      const verdict = got === c.want ? "ok" : "bad";
      results.push([verdict, c.name]);
      console.log(
        `[${verdict}] ${c.name} | service='${c.service}' is_global=${c.isGlobal} go_china=${c.goChina} region='${c.region}' -> got='${got}' want='${c.want}'`,
      );
      expect(got).toBe(c.want);
    }
    const passed = results.filter(([v]) => v === "ok").length;
    console.log(
      `--- Decision table summary: ${passed} ok, ${results.length - passed} bad, ${results.length} total ---`,
    );
  });
});

describe("resolveDefaultEndpoint - region normalization", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    useEnv();
  });

  it("normalizes region via trim().toLowerCase() before matching cn", () => {
    const info: ServiceEndpointInfo = {
      Service: "svc-region-norm",
      IsGlobal: false,
      GoChinaEnabled: true,
    };
    for (const region of ["CN-Beijing", "  cn-beijing  ", "cn-beijing"]) {
      const got = withTempService(info, () =>
        resolveDefaultEndpoint("svc-region-norm", region),
      );
      expect(got).toBe("svc-region-norm.cn-beijing.byteplusapi.com.cn");
    }
  });
});

describe("resolveDefaultEndpoint - cn-hongkong whitelist", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    useEnv();
  });

  it("cn-hongkong stays on international .com suffix even when gochina enabled", () => {
    const info: ServiceEndpointInfo = {
      Service: "svc-hk",
      IsGlobal: false,
      GoChinaEnabled: true,
    };
    const got = withTempService(info, () =>
      resolveDefaultEndpoint("svc-hk", "cn-hongkong"),
    );
    expect(got).toBe("svc-hk.cn-hongkong.byteplusapi.com");
  });
});

describe("resolveDefaultEndpoint - DualStack", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    useEnv();
  });

  it("swaps byteplusapi.com for byteplus-api.com when useDualStack=true", () => {
    const info: ServiceEndpointInfo = {
      Service: "svc-dual",
      IsGlobal: false,
      GoChinaEnabled: false,
    };
    const got = withTempService(info, () =>
      resolveDefaultEndpoint("svc-dual", "ap-southeast-1", true),
    );
    expect(got).toBe("svc-dual.ap-southeast-1.byteplus-api.com");
  });

  it("keeps .cn suffix on DualStack for mainland cn regions", () => {
    const info: ServiceEndpointInfo = {
      Service: "svc-dual-cn",
      IsGlobal: false,
      GoChinaEnabled: true,
    };
    const got = withTempService(info, () =>
      resolveDefaultEndpoint("svc-dual-cn", "cn-beijing", true),
    );
    expect(got).toBe("svc-dual-cn.cn-beijing.byteplus-api.com.cn");
  });

  it("reads BYTEPLUS_ENABLE_DUALSTACK env var when useDualStack undefined", () => {
    useEnv({ enableDualstack: true });
    const info: ServiceEndpointInfo = {
      Service: "svc-dual-env",
      IsGlobal: false,
      GoChinaEnabled: false,
    };
    const got = withTempService(info, () =>
      resolveDefaultEndpoint("svc-dual-env", "ap-southeast-1"),
    );
    expect(got).toBe("svc-dual-env.ap-southeast-1.byteplus-api.com");
  });

  it("useDualStack=false argument overrides env=true", () => {
    useEnv({ enableDualstack: true });
    const info: ServiceEndpointInfo = {
      Service: "svc-dual-override",
      IsGlobal: false,
      GoChinaEnabled: false,
    };
    const got = withTempService(info, () =>
      resolveDefaultEndpoint("svc-dual-override", "ap-southeast-1", false),
    );
    expect(got).toBe("svc-dual-override.ap-southeast-1.byteplusapi.com");
  });
});

describe("resolveDefaultEndpoint - service missing fail-fast", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    useEnv();
  });

  it("throws ServiceEndpointInfoMissingError for unregistered service", () => {
    expect(() =>
      resolveDefaultEndpoint("definitely-not-a-real-service", "ap-southeast-1"),
    ).toThrow(ServiceEndpointInfoMissingError);
    try {
      resolveDefaultEndpoint("definitely-not-a-real-service", "ap-southeast-1");
    } catch (err) {
      if (err instanceof ServiceEndpointInfoMissingError) {
        expect(err.service).toBe("definitely-not-a-real-service");
        expect(err.message).toContain(
          "service 'definitely-not-a-real-service' not registered",
        );
      } else {
        throw err;
      }
    }
  });

  it("built-in services still resolve without registration", () => {
    // vpc is already in the built-in map; sanity check the compat wrapper.
    expect(
      resolveDefaultEndpoint("vpc", "ap-southeast-1"),
    ).toBe("vpc.ap-southeast-1.byteplusapi.com");
    expect(
      resolveDefaultEndpoint("iam", "ap-southeast-1"),
    ).toBe("iam.byteplusapi.com");
  });

  it("service code with underscore is normalized to hyphen", () => {
    expect(
      resolveDefaultEndpoint("cloud_detect", "ap-southeast-1"),
    ).toBe("cloud-detect.ap-southeast-1.byteplusapi.com");
  });
});

describe("getDefaultEndpointByServiceInfo - backwards-compatible wrapper", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    useEnv();
  });

  it("returns default open endpoint for unregistered service instead of throwing", () => {
    // Preserves the historic public API: fallback to the open endpoint on
    // unregistered service so existing callers do not crash.
    const got = getDefaultEndpointByServiceInfo(
      "definitely-not-a-real-service",
      "ap-southeast-1",
    );
    expect(got).toBe("open.ap-southeast-1.byteplusapi.com");
  });

  it("resolves built-in vpc even for arbitrary regions (no bootstrap gate)", () => {
    // Old code returned "open.ap-southeast-1.byteplusapi.com" when the region
    // was not in the bootstrap list. The new pipeline unconditionally builds
    // {service}.{region}.byteplusapi.com from the service registration.
    const got = getDefaultEndpointByServiceInfo(
      "vpc",
      "some-arbitrary-region",
    );
    expect(got).toBe("vpc.some-arbitrary-region.byteplusapi.com");
  });
});



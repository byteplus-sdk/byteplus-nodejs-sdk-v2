import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { getDefaultEndpointByServiceInfo } from "../src/utils/endpoint";
import * as envUtils from "../src/utils/env";
import * as fs from "fs";

// Mock the dependencies
jest.mock("../src/utils/env");
jest.mock("fs");

describe("getDefaultEndpointByServiceInfo", () => {
  const mockLoadEnv = envUtils.loadEnv as jest.MockedFunction<
    typeof envUtils.loadEnv
  >;
  const mockReadFileSync = fs.readFileSync as jest.MockedFunction<
    typeof fs.readFileSync
  >;

  beforeEach(() => {
    jest.resetAllMocks();
    // Default mock implementation for loadEnv
    mockLoadEnv.mockReturnValue({
      credentials: {},
      enableDualstack: false,
      bootstrapRegionListConf: undefined,
    });
  });

  it("should return default endpoint for non-bootstrap region", () => {
    const service = "vpc";
    const region = "custom-non-bootstrap-region"; // Not in bootstrap list
    const endpoint = getDefaultEndpointByServiceInfo(service, region);

    // endpoint.ts: const endpoint = "open.ap-southeast-1.byteplusapi.com";
    expect(endpoint).toBe("open.ap-southeast-1.byteplusapi.com");
  });

  it("should return correct endpoint for global service in bootstrap region", () => {
    const service = "iam"; // IsGlobal: true
    const region = "ap-southeast-1"; // In bootstrap list

    const endpoint = getDefaultEndpointByServiceInfo(service, region);

    // iam is global, so expected: iam.byteplusapi.com
    expect(endpoint).toBe("iam.byteplusapi.com");
  });

  it("should return correct endpoint for regional service in bootstrap region", () => {
    const service = "vpc"; // IsGlobal: false
    const region = "ap-southeast-1";

    const endpoint = getDefaultEndpointByServiceInfo(service, region);

    // vpc is regional, expected: vpc.ap-southeast-1.byteplusapi.com
    expect(endpoint).toBe("vpc.ap-southeast-1.byteplusapi.com");
  });

  it("should handle dualstack enabled via argument", () => {
    const service = "iam";
    const region = "ap-southeast-1";
    const useDualStack = true;

    const endpoint = getDefaultEndpointByServiceInfo(
      service,
      region,
      undefined,
      useDualStack,
    );

    // dualstack suffix: .byteplus-api.com
    expect(endpoint).toBe("iam.byteplus-api.com");
  });

  it("should handle dualstack enabled via env", () => {
    mockLoadEnv.mockReturnValue({
      credentials: {},
      enableDualstack: true,
      bootstrapRegionListConf: undefined,
    });

    const service = "vpc";
    const region = "ap-southeast-1";

    const endpoint = getDefaultEndpointByServiceInfo(service, region);

    expect(endpoint).toBe("vpc.ap-southeast-1.byteplus-api.com");
  });

  it("should prioritize useDualStack argument over env variable", () => {
    mockLoadEnv.mockReturnValue({
      credentials: {},
      enableDualstack: true, // Env says true
      bootstrapRegionListConf: undefined,
    });

    const service = "vpc";
    const region = "ap-southeast-1";

    // Argument says false
    const endpoint = getDefaultEndpointByServiceInfo(
      service,
      region,
      undefined,
      false,
    );

    // Should NOT have dualstack suffix
    expect(endpoint).toBe("vpc.ap-southeast-1.byteplusapi.com");
  });

  it("should respect custom bootstrap region", () => {
    const service = "vpc";
    const region = "custom-region";
    const customBootstrapRegion = { "custom-region": {} };

    const endpoint = getDefaultEndpointByServiceInfo(
      service,
      region,
      customBootstrapRegion,
    );

    expect(endpoint).toBe("vpc.custom-region.byteplusapi.com");
  });

  it("should read bootstrap region from file if configured", () => {
    const region = "file-region";
    const service = "vpc";

    mockLoadEnv.mockReturnValue({
      credentials: {},
      enableDualstack: false,
      bootstrapRegionListConf: "/path/to/conf",
    });

    mockReadFileSync.mockReturnValue("file-region\nanother-region");

    const endpoint = getDefaultEndpointByServiceInfo(service, region);

    expect(endpoint).toBe("vpc.file-region.byteplusapi.com");
    expect(mockReadFileSync).toHaveBeenCalledWith(
      expect.stringContaining("/path/to/conf"),
      "utf8",
    );
  });

  it("should append .cn suffix for cn mainland region", () => {
    const service = "vpc";
    const region = "cn-beijing";
    const customBootstrapRegion = { "cn-beijing": {} };

    const endpoint = getDefaultEndpointByServiceInfo(
      service,
      region,
      customBootstrapRegion,
    );

    expect(endpoint).toBe("vpc.cn-beijing.byteplusapi.com.cn");
  });

  it("should append .cn suffix for cn mainland region with dualstack", () => {
    const service = "vpc";
    const region = "cn-shanghai";
    const customBootstrapRegion = { "cn-shanghai": {} };

    const endpoint = getDefaultEndpointByServiceInfo(
      service,
      region,
      customBootstrapRegion,
      true,
    );

    expect(endpoint).toBe("vpc.cn-shanghai.byteplus-api.com.cn");
  });

  it("should NOT append .cn suffix for cn-hongkong", () => {
    const service = "vpc";
    const region = "cn-hongkong";
    const customBootstrapRegion = { "cn-hongkong": {} };

    const endpoint = getDefaultEndpointByServiceInfo(
      service,
      region,
      customBootstrapRegion,
    );

    expect(endpoint).toBe("vpc.cn-hongkong.byteplusapi.com");
  });

  it("should NOT append .cn suffix for global service in cn region", () => {
    const service = "iam"; // IsGlobal: true
    const region = "cn-beijing";
    const customBootstrapRegion = { "cn-beijing": {} };

    const endpoint = getDefaultEndpointByServiceInfo(
      service,
      region,
      customBootstrapRegion,
    );

    expect(endpoint).toBe("iam.byteplusapi.com");
  });

  it("should standardize service code (replace _ with -)", () => {
    const service = "cloud_detect"; // In map: cloud_detect
    const region = "ap-southeast-1";

    const endpoint = getDefaultEndpointByServiceInfo(service, region);

    // cloud_detect -> cloud-detect
    expect(endpoint).toBe("cloud-detect.ap-southeast-1.byteplusapi.com");
  });

  it("should return default endpoint for unknown service in bootstrap region", () => {
    const service = "unknown_service";
    const region = "ap-southeast-1";

    const endpoint = getDefaultEndpointByServiceInfo(service, region);

    // unknown_service is not in the defaultEndpoint map, so it returns the default endpoint
    expect(endpoint).toBe("open.ap-southeast-1.byteplusapi.com");
  });

  it("should return global endpoint if RegionEndpointMap does not contain the region", () => {
    const service = "vpc";
    const region = "ap-southeast-1";

    const endpoint = getDefaultEndpointByServiceInfo(service, region);
    expect(endpoint).toBe("vpc.ap-southeast-1.byteplusapi.com");
  });

  it("should handle error when reading bootstrap region file", () => {
    const region = "file-region";
    const service = "vpc";

    mockLoadEnv.mockReturnValue({
      credentials: {},
      enableDualstack: false,
      bootstrapRegionListConf: "/path/to/conf",
    });

    mockReadFileSync.mockImplementation(() => {
      throw new Error("File not found");
    });

    const endpoint = getDefaultEndpointByServiceInfo(service, region);

    // Should fallback to checking other bootstrap sources, eventually failing to match 'file-region'
    // So it returns the default endpoint (open.ap-southeast-1.byteplusapi.com)
    expect(endpoint).toBe("open.ap-southeast-1.byteplusapi.com");
  });
});

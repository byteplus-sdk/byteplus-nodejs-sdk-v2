import fs from "fs";
import crypto from "crypto";
import path from "path";
import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

const mockStsResolveCredentials = jest.fn<() => Promise<any>>();
const mockOidcResolveCredentials = jest.fn<() => Promise<any>>();
const mockEcsResolveCredentials = jest.fn<() => Promise<any>>();
const mockStsAssumeRoleProvider = jest.fn().mockImplementation(() => ({
  providerName: "StsAssumeRoleProvider",
  resolveCredentials: mockStsResolveCredentials,
}));
const mockOidcCredentialProvider = jest.fn().mockImplementation(() => ({
  providerName: "OidcCredentialProvider",
  resolveCredentials: mockOidcResolveCredentials,
}));
const mockEcsRoleCredentialProvider = jest.fn().mockImplementation(() => ({
  providerName: "EcsRoleCredentialProvider",
  resolveCredentials: mockEcsResolveCredentials,
}));

jest.mock("fs");
jest.mock("path");
jest.mock("../../src/credentials/StsAssumeRoleProvider", () => ({
  StsAssumeRoleProvider: mockStsAssumeRoleProvider,
}));
jest.mock("../../src/credentials/OidcCredentialProvider", () => ({
  OidcCredentialProvider: mockOidcCredentialProvider,
}));
jest.mock("../../src/credentials/EcsRoleCredentialProvider", () => ({
  EcsRoleCredentialProvider: mockEcsRoleCredentialProvider,
}));

const {
  CLIConfigCredentialProvider,
} = require("../../src/credentials/CLIConfigCredentialProvider");

describe("CLIConfigCredentialProvider", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.BYTEPLUS_CLI_CONFIG_FILE;
    delete process.env.BYTEPLUS_PROFILE;
    delete process.env.BYTEPLUS_CLI_PROFILE;
    jest.clearAllMocks();
    mockStsResolveCredentials.mockResolvedValue({
      accessKeyId: "sts-ak",
      secretAccessKey: "sts-sk",
      sessionToken: "sts-token",
      providerName: "StsAssumeRoleProvider",
    });
    mockOidcResolveCredentials.mockResolvedValue({
      accessKeyId: "oidc-ak",
      secretAccessKey: "oidc-sk",
      sessionToken: "oidc-token",
      providerName: "OidcCredentialProvider",
    });
    mockEcsResolveCredentials.mockResolvedValue({
      accessKeyId: "ecs-ak",
      secretAccessKey: "ecs-sk",
      sessionToken: "ecs-token",
      providerName: "EcsRoleCredentialProvider",
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("should resolve credentials from default config path", async () => {
    process.env.HOME = "/mock/home";

    (path.resolve as jest.Mock).mockReturnValue(
      "/mock/home/.byteplus/config.json",
    );
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({
        current: "default",
        profiles: {
          default: {
            "access-key": "cli-ak",
            "secret-key": "cli-sk",
            "session-token": "cli-token",
          },
        },
      }),
    );

    const provider = new CLIConfigCredentialProvider();
    const creds = await provider.resolveCredentials();

    expect(creds.accessKeyId).toBe("cli-ak");
    expect(creds.secretAccessKey).toBe("cli-sk");
    expect(creds.sessionToken).toBe("cli-token");
    expect(creds.providerName).toBe("CLIConfigCredentialProvider");
  });

  it("should use BYTEPLUS_CLI_CONFIG_FILE env var if set", async () => {
    process.env.BYTEPLUS_CLI_CONFIG_FILE = "/custom/path/config.json";

    (path.resolve as jest.Mock).mockReturnValue("/custom/path/config.json");
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({
        current: "prod",
        profiles: {
          prod: {
            "access-key": "custom-ak",
            "secret-key": "custom-sk",
          },
        },
      }),
    );

    const provider = new CLIConfigCredentialProvider();
    const creds = await provider.resolveCredentials();

    expect(creds.accessKeyId).toBe("custom-ak");
    expect(creds.secretAccessKey).toBe("custom-sk");
    expect(creds.sessionToken).toBeUndefined();
  });

  it("should use USERPROFILE on Windows when HOME is not set", async () => {
    delete process.env.HOME;
    process.env.USERPROFILE = "C:\\Users\\test";

    (path.resolve as jest.Mock).mockReturnValue(
      "C:\\Users\\test\\.byteplus\\config.json",
    );
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({
        current: "default",
        profiles: {
          default: {
            "access-key": "win-ak",
            "secret-key": "win-sk",
          },
        },
      }),
    );

    const provider = new CLIConfigCredentialProvider();
    const creds = await provider.resolveCredentials();

    expect(creds.accessKeyId).toBe("win-ak");
    expect(creds.secretAccessKey).toBe("win-sk");
  });

  it("should throw if HOME and USERPROFILE are both unset", async () => {
    delete process.env.HOME;
    delete process.env.USERPROFILE;

    const provider = new CLIConfigCredentialProvider();
    await expect(provider.resolveCredentials()).rejects.toThrow(
      "HOME / USERPROFILE environment variable is not set",
    );
  });

  it("should throw if config file does not exist", async () => {
    process.env.HOME = "/mock/home";

    (path.resolve as jest.Mock).mockReturnValue(
      "/mock/home/.byteplus/config.json",
    );
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    const provider = new CLIConfigCredentialProvider();
    await expect(provider.resolveCredentials()).rejects.toThrow(
      "config file not found at",
    );
  });

  it("should throw friendly error on invalid JSON", async () => {
    process.env.HOME = "/mock/home";

    (path.resolve as jest.Mock).mockReturnValue(
      "/mock/home/.byteplus/config.json",
    );
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue("{ invalid json }");

    const provider = new CLIConfigCredentialProvider();
    await expect(provider.resolveCredentials()).rejects.toThrow(
      "failed to parse config file",
    );
  });

  it("should throw if no valid profile found", async () => {
    process.env.HOME = "/mock/home";

    (path.resolve as jest.Mock).mockReturnValue(
      "/mock/home/.byteplus/config.json",
    );
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({ profiles: {}, current: "nonexistent" }),
    );

    const provider = new CLIConfigCredentialProvider();
    await expect(provider.resolveCredentials()).rejects.toThrow(
      "not found in config file",
    );
  });

  it("should throw if profile is missing access-key or secret-key", async () => {
    process.env.HOME = "/mock/home";

    (path.resolve as jest.Mock).mockReturnValue(
      "/mock/home/.byteplus/config.json",
    );
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({
        current: "default",
        profiles: { default: { "access-key": "ak-only" } },
      }),
    );

    const provider = new CLIConfigCredentialProvider();
    await expect(provider.resolveCredentials()).rejects.toThrow(
      "does not contain valid access-key and secret-key",
    );
  });

  it("should select profile from BYTEPLUS_PROFILE", async () => {
    process.env.HOME = "/mock/home";
    process.env.BYTEPLUS_PROFILE = "prod";

    (path.resolve as jest.Mock).mockReturnValue(
      "/mock/home/.byteplus/config.json",
    );
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({
        current: "default",
        profiles: {
          default: {
            "access-key": "default-ak",
            "secret-key": "default-sk",
          },
          prod: {
            "access-key": "prod-ak",
            "secret-key": "prod-sk",
          },
        },
      }),
    );

    const provider = new CLIConfigCredentialProvider();
    const creds = await provider.resolveCredentials();

    expect(creds.accessKeyId).toBe("prod-ak");
    expect(creds.secretAccessKey).toBe("prod-sk");
  });

  it("should delegate ramrolearn mode to StsAssumeRoleProvider", async () => {
    process.env.HOME = "/mock/home";

    (path.resolve as jest.Mock).mockReturnValue(
      "/mock/home/.byteplus/config.json",
    );
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({
        current: "ram",
        profiles: {
          ram: {
            mode: "RamRoleArn",
            "access-key": "base-ak",
            "secret-key": "base-sk",
            "session-token": "base-token",
            "account-id": "2000012345",
            "role-name": "demo-role",
            region: "cn-shanghai",
            "disable-ssl": true,
          },
        },
      }),
    );

    const provider = new CLIConfigCredentialProvider();
    const creds = await provider.resolveCredentials();

    expect(mockStsAssumeRoleProvider).toHaveBeenCalledWith({
      accessKeyId: "base-ak",
      secretAccessKey: "base-sk",
      roleTrn: "trn:iam::2000012345:role/demo-role",
      region: "cn-shanghai",
      protocol: "http",
      durationSeconds: 3600,
    });
    expect(creds.providerName).toBe("StsAssumeRoleProvider");
  });

  it("should delegate oidc mode to OidcCredentialProvider", async () => {
    process.env.HOME = "/mock/home";

    (path.resolve as jest.Mock).mockReturnValue(
      "/mock/home/.byteplus/config.json",
    );
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({
        current: "oidc",
        profiles: {
          oidc: {
            mode: "OIDC",
            "role-trn": "trn:iam::2000012345:role/oidc-role",
            "oidc-token-file": "/tmp/oidc-token",
          },
        },
      }),
    );

    const provider = new CLIConfigCredentialProvider();
    const creds = await provider.resolveCredentials();

    expect(mockOidcCredentialProvider).toHaveBeenCalledWith({
      roleTrn: "trn:iam::2000012345:role/oidc-role",
      oidcTokenFile: "/tmp/oidc-token",
      region: "ap-southeast-1",
      protocol: "https",
      durationSeconds: 3600,
    });
    expect(creds.providerName).toBe("OidcCredentialProvider");
  });

  it("should delegate ecsrole mode to EcsRoleCredentialProvider", async () => {
    process.env.HOME = "/mock/home";

    (path.resolve as jest.Mock).mockReturnValue(
      "/mock/home/.byteplus/config.json",
    );
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({
        current: "ecs",
        profiles: {
          ecs: {
            mode: "ecsrole",
            "role-name": "ecs-role",
          },
        },
      }),
    );

    const provider = new CLIConfigCredentialProvider();
    const creds = await provider.resolveCredentials();

    expect(mockEcsRoleCredentialProvider).toHaveBeenCalledWith({
      roleName: "ecs-role",
    });
    expect(creds.providerName).toBe("EcsRoleCredentialProvider");
  });

  it("should resolve valid StsToken mode from cached temporary credentials", async () => {
    process.env.HOME = "/mock/home";

    (path.resolve as jest.Mock).mockReturnValue(
      "/mock/home/.byteplus/config.json",
    );
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({
        current: "sts",
        profiles: {
          sts: {
            mode: "StsToken",
            "access-key": "tmp-ak",
            "secret-key": "tmp-sk",
            "session-token": "tmp-token",
            "sts-expiration": Date.now() + 60 * 60 * 1000,
          },
        },
      }),
    );

    const provider = new CLIConfigCredentialProvider();
    const creds = await provider.resolveCredentials();

    expect(creds).toEqual({
      accessKeyId: "tmp-ak",
      secretAccessKey: "tmp-sk",
      sessionToken: "tmp-token",
      providerName: "CLIConfigCredentialProvider",
    });
  });

  it("should resolve console-login credentials from login cache", async () => {
    process.env.HOME = "/mock/home";
    process.env.BYTEPLUS_LOGIN_CACHE_DIRECTORY = "/mock/login/cache";
    const loginSession = "console-session";
    const cachePath = `/mock/login/cache/${crypto
      .createHash("sha1")
      .update(loginSession)
      .digest("hex")}.json`;

    (path.resolve as jest.Mock).mockReturnValue(
      "/mock/home/.byteplus/config.json",
    );
    (path.join as jest.Mock).mockImplementation((...parts: unknown[]) =>
      parts.join("/"),
    );
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockImplementation((filePath: unknown) => {
      if (filePath === "/mock/home/.byteplus/config.json") {
        return JSON.stringify({
          current: "console",
          profiles: {
            console: {
              mode: "console-login",
              "login-session": loginSession,
            },
          },
        });
      }
      if (filePath === cachePath) {
        return JSON.stringify({
          access_token: JSON.stringify({
            access_key_id: "login-ak",
            secret_access_key: "login-sk",
            session_token: "login-token",
          }),
          issued_at: new Date().toISOString(),
          expires_in: 3600,
          refresh_token: "login-refresh-token",
          client_id: "login-client-id",
        });
      }
      throw new Error(`unexpected read: ${filePath}`);
    });

    const provider = new CLIConfigCredentialProvider();
    const creds = await provider.resolveCredentials();

    expect(creds).toEqual({
      accessKeyId: "login-ak",
      secretAccessKey: "login-sk",
      sessionToken: "login-token",
      providerName: "CLIConfigCredentialProvider",
    });
  });

  it("should keep rotated console-login refresh token in memory", async () => {
    process.env.HOME = "/mock/home";
    process.env.BYTEPLUS_LOGIN_CACHE_DIRECTORY = "/mock/login/cache";
    const loginSession = "console-session";
    const cachePath = `/mock/login/cache/${crypto
      .createHash("sha1")
      .update(loginSession)
      .digest("hex")}.json`;

    (path.resolve as jest.Mock).mockReturnValue(
      "/mock/home/.byteplus/config.json",
    );
    (path.join as jest.Mock).mockImplementation((...parts: unknown[]) =>
      parts.join("/"),
    );
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockImplementation((filePath: unknown) => {
      if (filePath === "/mock/home/.byteplus/config.json") {
        return JSON.stringify({
          current: "console",
          profiles: {
            console: {
              mode: "console-login",
              "login-session": loginSession,
            },
          },
        });
      }
      if (filePath === cachePath) {
        return JSON.stringify({
          access_token: JSON.stringify({
            access_key_id: "old-ak",
            secret_access_key: "old-sk",
            session_token: "old-token",
          }),
          issued_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          expires_in: 1,
          refresh_token: "rt1",
          client_id: "login-client-id",
        });
      }
      throw new Error(`unexpected read: ${filePath}`);
    });

    const requestFormUrlEncoded = jest
      .fn<(...args: any[]) => Promise<any>>()
      .mockResolvedValueOnce({
        access_token: JSON.stringify({
          access_key_id: "ak1",
          secret_access_key: "sk1",
          session_token: "token1",
        }),
        expires_in: 3600,
        refresh_token: "rt2",
      })
      .mockResolvedValueOnce({
        access_token: JSON.stringify({
          access_key_id: "ak2",
          secret_access_key: "sk2",
          session_token: "token2",
        }),
        expires_in: 3600,
        refresh_token: "rt3",
      });
    const provider = new CLIConfigCredentialProvider();
    (provider as any).requestFormUrlEncoded = requestFormUrlEncoded;

    const first = await provider.resolveCredentials();
    const memoryCache = (provider as any).consoleLoginTokenCaches.get(
      cachePath,
    );
    memoryCache.issued_at = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    memoryCache.expires_in = 1;
    (provider as any).delegate = undefined;
    const second = await provider.resolveCredentials();

    expect(first.accessKeyId).toBe("ak1");
    expect(second.accessKeyId).toBe("ak2");
    expect(requestFormUrlEncoded).toHaveBeenNthCalledWith(
      1,
      "https://signin.byteplus.com/authorize/oauth/token",
      {
        grant_type: "refresh_token",
        client_id: "login-client-id",
        refresh_token: "rt1",
      },
    );
    expect(requestFormUrlEncoded).toHaveBeenNthCalledWith(
      2,
      "https://signin.byteplus.com/authorize/oauth/token",
      {
        grant_type: "refresh_token",
        client_id: "login-client-id",
        refresh_token: "rt2",
      },
    );
    expect((fs.readFileSync as jest.Mock).mock.calls).toEqual([
      ["/mock/home/.byteplus/config.json", { encoding: "utf-8" }],
      [cachePath, { encoding: "utf-8" }],
      ["/mock/home/.byteplus/config.json", { encoding: "utf-8" }],
    ]);
  });

  it("should refresh SSO token and fetch role credentials from bytepluses.com endpoints", async () => {
    process.env.HOME = "/mock/home";

    const startUrl = "https://example.awsapps.com/start";
    const sessionName = "my-sso-session";
    const region = "ap-southeast-1";
    const tokenCacheHash = crypto
      .createHash("sha1")
      .update(
        JSON.stringify({ start_url: startUrl, session_name: sessionName }),
      )
      .digest("hex");
    const tokenCachePath = `/mock/home/.byteplus/sso/cache/${tokenCacheHash}.json`;

    (path.resolve as jest.Mock).mockReturnValue(
      "/mock/home/.byteplus/config.json",
    );
    (path.dirname as jest.Mock).mockReturnValue("/mock/home/.byteplus");
    (path.join as jest.Mock).mockImplementation((...parts: unknown[]) =>
      parts.join("/"),
    );
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockImplementation((filePath: unknown) => {
      if (filePath === "/mock/home/.byteplus/config.json") {
        return JSON.stringify({
          current: "sso",
          profiles: {
            sso: {
              mode: "SSO",
              "sso-session-name": sessionName,
              "account-id": "2000012345",
              "role-name": "demo-role",
              region,
            },
          },
          "sso-session": {
            [sessionName]: {
              "start-url": startUrl,
              region,
            },
          },
        });
      }
      if (filePath === tokenCachePath) {
        return JSON.stringify({
          access_token: "old-access-token",
          refresh_token: "the-refresh-token",
          client_id: "the-client-id",
          client_secret: "the-client-secret",
          // 已过期，强制走 refresh 流程
          expires_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        });
      }
      throw new Error(`unexpected read: ${filePath}`);
    });

    const requestJson = jest
      .fn<(...args: any[]) => Promise<any>>()
      .mockResolvedValueOnce({
        access_token: "new-access-token",
        expires_in: 3600,
        refresh_token: "rotated-refresh-token",
      })
      .mockResolvedValueOnce({
        Result: {
          RoleCredentials: {
            AccessKeyId: "sso-ak",
            SecretAccessKey: "sso-sk",
            SessionToken: "sso-token",
            Expiration: Math.floor((Date.now() + 60 * 60 * 1000) / 1000),
          },
        },
      });

    const provider = new CLIConfigCredentialProvider();
    (provider as any).requestJson = requestJson;

    const creds = await provider.resolveCredentials();

    expect(creds.accessKeyId).toBe("sso-ak");
    expect(creds.secretAccessKey).toBe("sso-sk");
    expect(creds.sessionToken).toBe("sso-token");
    expect(creds.providerName).toBe("CLIConfigCredentialProvider");

    // 断言 OAuth refresh token 请求的完整 URL 使用 bytepluses.com
    expect(requestJson).toHaveBeenNthCalledWith(
      1,
      "POST",
      `https://cloudidentity-oauth.${region}.bytepluses.com/token`,
      {
        grant_type: "refresh_token",
        client_id: "the-client-id",
        client_secret: "the-client-secret",
        refresh_token: "the-refresh-token",
      },
    );

    // 断言 Portal 换取角色凭证请求的完整 URL 使用 bytepluses.com
    const portalCall = requestJson.mock.calls[1];
    expect(portalCall[0]).toBe("GET");
    expect(portalCall[1]).toBe(
      `https://cloudidentity-portal.${region}.bytepluses.com/federation/credentials?account_id=2000012345&role_name=demo-role`,
    );
  });

  it("should cache StsToken credentials and skip re-reading config file on subsequent calls", async () => {
    process.env.HOME = "/mock/home";

    (path.resolve as jest.Mock).mockReturnValue(
      "/mock/home/.byteplus/config.json",
    );
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({
        current: "sts",
        profiles: {
          sts: {
            mode: "StsToken",
            "access-key": "tmp-ak",
            "secret-key": "tmp-sk",
            "session-token": "tmp-token",
            "sts-expiration": Math.floor((Date.now() + 60 * 60 * 1000) / 1000),
          },
        },
      }),
    );

    const provider = new CLIConfigCredentialProvider();
    const first = await provider.resolveCredentials();
    const second = await provider.resolveCredentials();

    expect(first).toEqual(second);
    // 第一次读配置，第二次应命中 delegate 缓存，不再调用 readFileSync
    expect((fs.readFileSync as jest.Mock).mock.calls.length).toBe(1);
  });
});

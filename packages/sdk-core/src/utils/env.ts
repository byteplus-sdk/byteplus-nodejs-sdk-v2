import path from "path";
import fs from "fs";

/** BytePlus 凭据信息 */
type ByteplusCredentials = {
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  /** OIDC 角色扮演相关配置（从环境变量读取） */
  assumeRoleWithOIDC?: {
    roleTrn: string;
    roleSessionName?: string;
    oidcTokenFile: string;
    host?: string;
    policy?: string;
  };
  /** SAML 角色扮演相关配置（从环境变量读取） */
  assumeRoleWithSAML?: {
    roleTrn: string;
    accountId: string;
    samlProviderTrn: string;
    samlAssertion: string;
    host?: string;
    policy?: string;
  };
  /** ECS 实例角色相关配置（从环境变量读取） */
  ecsRole?: {
    roleName: string;
    disabled?: boolean;
  };
  /** CLI 配置文件路径（BYTEPLUS_CLI_CONFIG_FILE） */
  configFilePath?: string;
};

/** 环境变量配置结构 */
export type EnvConfig = {
  /** 凭据信息 */
  credentials: ByteplusCredentials;
  /** 是否启用双栈（IPv4/IPv6）支持 */
  enableDualstack?: boolean;
  /** 代理配置 */
  proxy?: {
    protocol: "http" | "https";
    host: string;
    port: number;
  };
};

/**
 * 从当前 Node.js 进程的环境变量中读取BytePlus SDK 配置。
 *
 * 凭据优先级：BYTEPLUS_ACCESS_KEY > BYTEPLUS_ACCESSKEY > BYTEPLUS_ACCESS_KEY_ID
 *
 * 支持的环境变量：
 * - 凭据：
 *   - BYTEPLUS_ACCESS_KEY / BYTEPLUS_ACCESSKEY / BYTEPLUS_ACCESS_KEY_ID
 *   - BYTEPLUS_SECRET_KEY / BYTEPLUS_SECRETKEY / BYTEPLUS_SECRET_ACCESS_KEY
 *   - BYTEPLUS_SESSION_TOKEN（可选）
 * - OIDC：
 *   - BYTEPLUS_OIDC_ROLE_TRN、BYTEPLUS_OIDC_TOKEN_FILE（必选）
 *   - BYTEPLUS_OIDC_ROLE_SESSION_NAME、BYTEPLUS_OIDC_HOST、BYTEPLUS_OIDC_ROLE_POLICY（可选）
 * - SAML：
 *   - BYTEPLUS_SAML_ROLE_TRN、BYTEPLUS_SAML_ACCOUNT_ID、BYTEPLUS_SAML_PROVIDER_TRN、BYTEPLUS_SAML_ASSERTION（必选）
 *   - BYTEPLUS_SAML_HOST、BYTEPLUS_SAML_POLICY（可选）
 * - ECS 实例角色：
 *   - BYTEPLUS_ECS_METADATA（角色名）
 *   - BYTEPLUS_ECS_METADATA_DISABLED（"true" 时禁用）
 * - CLI 配置文件：
 *   - BYTEPLUS_CLI_CONFIG_FILE
 * - 网络：
 *   - BYTEPLUS_ENABLE_DUALSTACK（布尔值，是否启用双栈）
 *   - BYTEPLUS_PROXY_HOST、BYTEPLUS_PROXY_PORT、BYTEPLUS_PROXY_PROTOCOL（代理配置）
 */
export function loadEnvFromProcess(): EnvConfig {
  const env = process.env;

  // ---- 凭据（优先级：BYTEPLUS_ACCESS_KEY > BYTEPLUS_ACCESSKEY > BYTEPLUS_ACCESS_KEY_ID）----
  const accessKeyId =
    env.BYTEPLUS_ACCESS_KEY ??
    env.BYTEPLUS_ACCESSKEY ??
    env.BYTEPLUS_ACCESS_KEY_ID;
  const secretAccessKey =
    env.BYTEPLUS_SECRET_KEY ??
    env.BYTEPLUS_SECRETKEY ??
    env.BYTEPLUS_SECRET_ACCESS_KEY;
  const sessionToken = env.BYTEPLUS_SESSION_TOKEN;

  // ---- OIDC 角色扮演 ----
  const oidcRoleTrn = env.BYTEPLUS_OIDC_ROLE_TRN;
  const oidcRoleSessionName = env.BYTEPLUS_OIDC_ROLE_SESSION_NAME;
  const oidcTokenFile = env.BYTEPLUS_OIDC_TOKEN_FILE;
  const oidcPolicy = env.BYTEPLUS_OIDC_ROLE_POLICY;
  const oidcStsEndpoint = env.BYTEPLUS_OIDC_STS_ENDPOINT;

  const assumeRoleWithOIDC =
    oidcTokenFile && oidcRoleTrn
      ? {
          roleTrn: oidcRoleTrn,
          roleSessionName: oidcRoleSessionName,
          oidcTokenFile: oidcTokenFile,
          host: oidcStsEndpoint,
          policy: oidcPolicy,
        }
      : undefined;

  // ---- SAML 角色扮演 ----
  const samlRoleTrn = env.BYTEPLUS_SAML_ROLE_TRN;
  const samlAccountId = env.BYTEPLUS_SAML_ACCOUNT_ID;
  const samlProviderTrn = env.BYTEPLUS_SAML_PROVIDER_TRN;
  const samlAssertion = env.BYTEPLUS_SAML_ASSERTION;
  const samlStsEndpoint = env.BYTEPLUS_SAML_ENDPOINT;
  const samlPolicy = env.BYTEPLUS_SAML_POLICY;

  const assumeRoleWithSAML =
    samlRoleTrn && samlAccountId && samlProviderTrn && samlAssertion
      ? {
          roleTrn: samlRoleTrn,
          accountId: samlAccountId,
          samlProviderTrn: samlProviderTrn,
          samlAssertion: samlAssertion,
          host: samlStsEndpoint,
          policy: samlPolicy,
        }
      : undefined;

  // ---- ECS 实例角色 ----
  const ecsMetadataRoleName = env.BYTEPLUS_ECS_METADATA;
  const ecsMetadataDisabledRaw = env.BYTEPLUS_ECS_METADATA_DISABLED;
  const ecsRole = ecsMetadataRoleName
    ? {
        roleName: ecsMetadataRoleName,
        disabled: ecsMetadataDisabledRaw === "true",
      }
    : undefined;

  // ---- CLI 配置文件路径 ----
  const configFilePath = env.BYTEPLUS_CLI_CONFIG_FILE;

  // ---- 双栈支持 ----
  const enableDualstack = env.BYTEPLUS_ENABLE_DUALSTACK === "true";

  // ---- 代理配置 ----
  const proxyProtocol = (env.BYTEPLUS_PROXY_PROTOCOL || "http") as
    | "http"
    | "https";
  const proxyHost = env.BYTEPLUS_PROXY_HOST;
  const proxyPort = env.BYTEPLUS_PROXY_PORT;

  const proxy =
    proxyHost || proxyPort
      ? {
          protocol: proxyProtocol,
          host: proxyHost || "127.0.0.1",
          port: proxyPort ? +proxyPort : proxyProtocol === "https" ? 443 : 80,
        }
      : undefined;

  return {
    credentials: {
      accessKeyId,
      secretAccessKey,
      sessionToken,
      assumeRoleWithOIDC,
      assumeRoleWithSAML,
      ecsRole,
      configFilePath,
    },
    enableDualstack,
    proxy,
  };
}

/**
 * 从环境变量加载配置（loadEnvFromProcess 的便捷别名）。
 */
export function loadEnv(): EnvConfig {
  const envConfig = loadEnvFromProcess();
  return envConfig;
}

/**
 * 从旧版本 CLI 配置文件 ~/.byteplus/config 读取凭据，用于兜底兼容。
 *
 * 配置文件格式：{ BYTEPLUS_ACCESS_KEY: "...", BYTEPLUS_SECRET_KEY: "..." }
 *
 * @returns 包含 accessKeyId / secretAccessKey 的对象，若文件不存在则返回空对象；HOME 未设置时返回 undefined
 */
export function loadNodeConfig() {
  const config: any = {};

  if (process.env.HOME) {
    const homeConfigPath = path.resolve(process.env.HOME, ".byteplus/config");
    if (fs.existsSync(homeConfigPath)) {
      const configData = JSON.parse(
        fs.readFileSync(homeConfigPath, { encoding: "utf-8" }),
      );
      if (configData.BYTEPLUS_ACCESS_KEY) {
        config.accessKeyId = configData.BYTEPLUS_ACCESS_KEY;
      }
      if (configData.BYTEPLUS_SECRET_KEY) {
        config.secretAccessKey = configData.BYTEPLUS_SECRET_KEY;
      }
    }
    return config;
  }
}

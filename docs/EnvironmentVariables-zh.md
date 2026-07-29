[← 概览](0-Overview-zh.md) | 环境变量 [(English)](EnvironmentVariables.md)

---

## 环境变量

本页集中列出 SDK 支持的所有环境变量，便于部署/CI 环境注入。

### 设置方法

#### Linux / macOS

临时（当前 shell 生效）：

```shell
export BYTEPLUS_ACCESS_KEY=your-ak
export BYTEPLUS_SECRET_KEY=your-sk
# 可选
export BYTEPLUS_SESSION_TOKEN=your-session-token
```

持久化：将 `export` 写入 `~/.bashrc`、`~/.zshrc` 等 shell 启动文件。

校验：`echo $BYTEPLUS_ACCESS_KEY` 返回预期值即设置成功。

#### Windows

命令行（以管理员身份运行）：

```cmd
setx BYTEPLUS_ACCESS_KEY your-ak /M
setx BYTEPLUS_SECRET_KEY your-sk /M
setx BYTEPLUS_SESSION_TOKEN your-session-token /M
```

`/M` 表示系统级；省略 `/M` 为用户级变量。

---

### 凭据（Credentials）

#### 基础 AK/SK/Token

| 变量                       | 说明                       | 必填 |
| -------------------------- | -------------------------- | :--: |
| `BYTEPLUS_ACCESS_KEY`    | Access Key                 |  ✅  |
| `BYTEPLUS_SECRET_KEY`    | Secret Key                 |  ✅  |
| `BYTEPLUS_SESSION_TOKEN` | STS 临时凭证 Session Token |  ❌  |

#### OIDC（AssumeRoleWithOIDC）

| 变量                                | 说明                    | 必填 |
| ----------------------------------- | ----------------------- | :--: |
| `BYTEPLUS_OIDC_ROLE_TRN`          | 要扮演的角色 TRN        |  ✅  |
| `BYTEPLUS_OIDC_TOKEN_FILE`        | OIDC Token 文件路径     |  ✅  |
| `BYTEPLUS_OIDC_ROLE_SESSION_NAME` | 角色会话名称            |  ❌  |
| `BYTEPLUS_OIDC_STS_ENDPOINT`      | 自定义 STS Endpoint     |  ❌  |
| `BYTEPLUS_OIDC_ROLE_POLICY`       | 会话策略（JSON 字符串） |  ❌  |

#### SAML（AssumeRoleWithSAML）

| 变量                           | 说明                     | 必填 |
| ------------------------------ | ------------------------ | :--: |
| `BYTEPLUS_SAML_ROLE_TRN`     | 要扮演的角色 TRN         |  ✅  |
| `BYTEPLUS_SAML_ACCOUNT_ID`   | BytePlus账号 ID          |  ✅  |
| `BYTEPLUS_SAML_PROVIDER_TRN` | SAML 身份提供者 TRN      |  ✅  |
| `BYTEPLUS_SAML_ASSERTION`    | SAML 断言（Base64 编码） |  ✅  |
| `BYTEPLUS_SAML_ENDPOINT`     | 自定义 STS Endpoint      |  ❌  |
| `BYTEPLUS_SAML_POLICY`       | 会话策略（JSON 字符串）  |  ❌  |

#### ECS 实例角色（IMDS）

| 变量                               | 说明                                          | 默认值 |
| ---------------------------------- | --------------------------------------------- | ------ |
| `BYTEPLUS_ECS_METADATA`          | 指定 ECS 实例角色名；未设置时从 IMDS 自动探测         | -      |
| `BYTEPLUS_ECS_METADATA_DISABLED` | 设为 `true` 禁用 IMDS 凭证获取                | -      |

#### CLI 配置文件

| 变量                         | 说明             | 默认值                      |
| ---------------------------- | ---------------- | --------------------------- |
| `BYTEPLUS_CLI_CONFIG_FILE` | CLI 配置文件路径 | `~/.byteplus/config.json` |

---

### Endpoint & 网络

| 变量                              | 说明                                          | 默认值  |
| --------------------------------- | --------------------------------------------- | ------- |
| `BYTEPLUS_ENABLE_DUALSTACK`           | 启用双栈（IPv4+IPv6），设为 `true` 启用       | `false` |

---

### HTTP 代理

当 `BYTEPLUS_PROXY_HOST` 或 `BYTEPLUS_PROXY_PORT` 任一被设置时，SDK 自动启用代理。

| 变量                  | 说明                         | 默认值                       |
| --------------------- | ---------------------------- | ---------------------------- |
| `BYTEPLUS_PROXY_PROTOCOL` | 代理协议（`http` / `https`） | `http`                       |
| `BYTEPLUS_PROXY_HOST`     | 代理主机地址                 | `127.0.0.1`                  |
| `BYTEPLUS_PROXY_PORT`     | 代理端口                     | `80`（http）/ `443`（https） |

---

### 默认凭证链顺序

未显式配置凭证时，`DefaultCredentialProvider` 按以下顺序依次尝试，首个成功的 Provider 生效：

| 顺序 | Provider                              | 依赖的环境变量                                                                         |
| :--: | ------------------------------------- | -------------------------------------------------------------------------------------- |
|  1   | EnvironmentVariableCredentialProvider | `BYTEPLUS_ACCESS_KEY` / `BYTEPLUS_ACCESS_KEY_ID` / `BYTEPLUS_ACCESS_KEY` + 对应 SK |
|  2   | OidcCredentialProvider                | `BYTEPLUS_OIDC_ROLE_TRN` + `BYTEPLUS_OIDC_TOKEN_FILE`                              |
|  3   | CLIConfigCredentialProvider           | `BYTEPLUS_CLI_CONFIG_FILE`（可选）                                                   |
|  4   | EcsRoleCredentialProvider             | `BYTEPLUS_ECS_METADATA`（可选），`BYTEPLUS_ECS_METADATA_DISABLED=true` 时跳过      |

---

### 优先级总表

| 配置项            | 优先级（高 → 低）                                               |
| ----------------- | --------------------------------------------------------------- |
| AK/SK/Token       | `BYTEPLUS_*` > `BYTEPLUS_*_ID` > `BYTEPLUS_*`               |
| OIDC STS Endpoint | 构造参数 `host` > `BYTEPLUS_OIDC_STS_ENDPOINT`                |
| SAML STS Endpoint | 构造参数 `host` > `BYTEPLUS_SAML_ENDPOINT`                    |
| CLI 配置文件路径  | `BYTEPLUS_CLI_CONFIG_FILE` > `~/.byteplus/config.json`      |
| ECS Role 名称     | 构造参数 `roleName` > `BYTEPLUS_ECS_METADATA` > IMDS 自动探测 |
| 双栈              | 构造参数 `useDualStack` > `BYTEPLUS_ENABLE_DUALSTACK`               |
| 代理              | 构造参数 `httpOptions.proxy` > `BYTEPLUS_PROXY_*`                   |

---

### 历史兼容变量（`BYTEPLUS_*`）

早期 SDK 使用 `BYTEPLUS_*` 前缀。当同名 `BYTEPLUS_*` 变量未设置时，下列变量会作为 fallback 生效。**新代码请统一使用 `BYTEPLUS_*`。**

| 变量                                                   | 等价的 `BYTEPLUS_*`      | Node.js | Go  | Python |
| ------------------------------------------------------ | -------------------------- | :-----: | :-: | :----: |
| `BYTEPLUS_ACCESS_KEY_ID` / `BYTEPLUS_ACCESS_KEY`     | `BYTEPLUS_ACCESS_KEY`    |   ✅    | ✅  |   ❌   |
| `BYTEPLUS_SECRET_ACCESS_KEY` / `BYTEPLUS_SECRET_KEY` | `BYTEPLUS_SECRET_KEY`    |   ✅    | ✅  |   ❌   |
| `BYTEPLUS_SESSION_TOKEN`                              | `BYTEPLUS_SESSION_TOKEN` |   ✅    | ✅  |   ❌   |

Fallback 优先级：`BYTEPLUS_*` > `BYTEPLUS_*_ID` > `BYTEPLUS_*`

---

### 相关文档

- [访问凭据](1-Credentials-zh.md) — 各 Provider 的代码级用法
- [Endpoint 配置](2-Endpoint-zh.md) — 双栈、引导区域列表详细说明
- [代理配置](4-Proxy-zh.md) — 代理配置的代码级用法

---

[← 概览](0-Overview-zh.md) | 环境变量 [(English)](EnvironmentVariables.md)

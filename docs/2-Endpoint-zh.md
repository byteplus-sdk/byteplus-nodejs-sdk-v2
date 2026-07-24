[← 访问凭据](1-Credentials-zh.md) | Endpoint 配置 [(English)](2-Endpoint.md) | [Transport →](3-Transport-zh.md)

---

## Endpoint 配置

> **默认**
>
> 不指定 `host` 时，走 [自动化 Endpoint 寻址](#自动化-endpoint-寻址)。

### 自定义 Endpoint

通过在客户端配置中直接指定 `host`，可以强制 SDK 将所有请求发送到该地址。这是最高优先级的配置，会跳过后续所有寻址逻辑。

```typescript
const client = new ECSClient({
  host: "open.ap-southeast-1.byteplusapi.com",
  region: "ap-southeast-1",
});
```

### 自定义 RegionId

Region 是大多数 BytePlus 服务的关键概念。你可以在客户端级别配置一个默认的 `region`。

```typescript
const client = new ECSClient({
  region: "ap-southeast-1",
});
```

### 自动化 Endpoint 寻址

> **默认**
>
> 默认支持自动寻址，无需手动指定 Endpoint。

BytePlus 提供了灵活的 Endpoint 自动寻址机制。SDK 会根据服务名称、Region、服务是否标记为 Go China 等信息自动拼接出访问地址，并支持 DualStack（双栈）。

#### Endpoint 默认寻址

##### 寻址逻辑

1. **服务注册判定**

   每个服务在内置映射中都会登记 `IsGlobal` 和 `GoChinaEnabled` 两个 bool 字段，SDK 按下方"标准寻址规则"构造 Endpoint。

   - 服务未在映射中登记：`resolveDefaultEndpoint` 会抛出 `ServiceEndpointInfoMissingError`（从 `@byteplus/sdk-core` 导出），错误消息形如 `byteplus-sdk: service endpoint info missing: service '<xxx>' not registered`。参见 [错误处理](#错误处理)。

   内置服务映射：[`packages/sdk-core/src/utils/endpoint.ts`](../packages/sdk-core/src/utils/endpoint.ts) 中的 `defaultEndpoint`。

2. **DualStack 支持（IPv6）**

   SDK 支持双栈网络（IPv4 + IPv6）访问地址，自动启用条件如下：显式传入参数 `useDualStack: true`，或设置环境变量 `BYTEPLUS_ENABLE_DUALSTACK=true`。优先级：`useDualStack` > `BYTEPLUS_ENABLE_DUALSTACK`。

   启用后，域名后缀将从 `byteplusapi.com` 切换为 `byteplus-api.com`。

3. **Go China 后缀**

   当服务在内置映射中标记 `GoChinaEnabled=true`，并且请求 Region 属于中国大陆（`cn-*` 前缀且不属于 `cn-hongkong` 等非大陆港澳台 Region）时，在域名后追加 `.cn` 后缀。

   是否 GoChina 由服务侧决定，不可修改。匹配前会先对 region 做 `trim().toLowerCase()` 归一化，因此 `CN-Beijing`、`  cn-beijing  ` 与 `cn-beijing` 等价。

4. **根据服务名和区域自动构造 Endpoint 地址**

   - **Global 服务（如 `IAM`、`Billing`）**：使用 `<服务名>.byteplusapi.com`（DualStack 时使用 `byteplus-api.com`；命中 Go China 时追加 `.cn`）。
   - **Regional 服务（如 `ECS`、`RDS`）**：使用 `<服务名>.<区域名>.byteplusapi.com` 作为默认 Endpoint（DualStack / Go China 规则同上）。

   > 服务名在拼接域名时会进行标准化：大写转小写，下划线 `_` 转连字符 `-`。例如 `rds_mysql` → `rds-mysql.ap-southeast-1.byteplusapi.com`。

##### 寻址决策表

下表列出所有生效组合。左侧列的 "RegionType" 由服务的 `IsGlobal` 决定；"请求 Region 是否 Go China" 指请求 Region 是否属于中国大陆。

| RegionType | GoChinaEnabled | 请求 Region 是否 Go China | Endpoint | 是否包含 Region |
|---|---|---|---|---|
| Global | true | 是 | `{service}.byteplusapi.com.cn` | 否 |
| Global | true | 否 | `{service}.byteplusapi.com` | 否 |
| Global | false | 任意 | `{service}.byteplusapi.com` | 否 |
| Regional | true | 是 | `{service}.{region}.byteplusapi.com.cn` | 是 |
| Regional | true | 否 | `{service}.{region}.byteplusapi.com` | 是 |
| Regional | false | 任意 | `{service}.{region}.byteplusapi.com` | 是 |

启用 DualStack 时，将上表中的 `byteplusapi.com` 整体替换为 `byteplus-api.com`。

##### STS 凭证 Provider

`StsAssumeRoleProvider` / `OidcCredentialProvider` / `SamlCredentialProvider` 共享同一份 STS host 派生规则。当 `host` 参数留空时，Provider 会用 `region` 自动寻址，命中与主链路一致的规则 —— 无需再显式配置 STS 域名。

Host 覆盖优先级（三级 fallback）：

- 显式 `host` 参数 > （仅 OIDC）`BYTEPLUS_OIDC_STS_ENDPOINT` 环境变量 > 基于 region 的 `defaultSTSHostFor(region)` > 空 region 时兜底至 `sts.ap-southeast-1.byteplusapi.com`。
- OIDC Provider 也可通过 `BYTEPLUS_OIDC_STS_REGION` 环境变量提供 region 以驱动 host 派生。
- `cn-hongkong` 属于非大陆港澳台白名单，解析为 `sts.cn-hongkong.byteplusapi.com`（使用国际 `.com` 后缀），与 Go/Java 保持一致。

共享的 `defaultSTSHostFor(region)` 工具函数：[`packages/sdk-core/src/utils/stsHost.ts`](../packages/sdk-core/src/utils/stsHost.ts)。

##### `customBootstrapRegion` / `BYTEPLUS_BOOTSTRAP_REGION_LIST_CONF`（已废弃）

> **⚠️ Deprecated**：`ClientConfig` 上的 `customBootstrapRegion` 字段以及 `BYTEPLUS_BOOTSTRAP_REGION_LIST_CONF` 环境变量已被标记为**废弃**，**不再参与**默认寻址链路。参数仅为 API 源码兼容而保留，运行时视为 no-op。请**勿在新代码中使用**，已有代码建议改用 `region` + `useDualStack` 让 SDK 自动寻址，或用 `host` 显式覆盖。

##### 代码示例

```typescript
import { ECSClient } from "@byteplus/ecs";

// SDK 会自动推导 Endpoint 为: ecs.ap-southeast-1.byteplusapi.com
const client = new ECSClient({
  region: "ap-southeast-1",
  useDualStack: true, // 启用双栈；也可通过环境变量 BYTEPLUS_ENABLE_DUALSTACK=true 启用
});
```

##### 错误处理

如果请求的服务名不在内置 `defaultEndpoint` 映射中，SDK 在第一次触发默认寻址时就会抛出 `ServiceEndpointInfoMissingError`，错误消息形如 `byteplus-sdk: service endpoint info missing: service '<xxx>' not registered`。可用如下方式识别：

```typescript
import { ServiceEndpointInfoMissingError } from "@byteplus/sdk-core";

try {
  await client.send(command);
} catch (err) {
  if (err instanceof ServiceEndpointInfoMissingError) {
    // err.service 携带缺失的服务名
    // SDK 版本可能不识别该服务，请升级依赖或显式指定 Endpoint。
    throw err;
  }
  throw err;
}
```

遇到该错误时，建议先升级 SDK 版本；若确认 SDK 尚未内置该服务的寻址元数据，可通过 `host` 显式指定 Endpoint。

### Endpoint 标准寻址

| Global 服务 | 双栈 | 格式 |
|---|---|---|
| 是 | 是 | `{Service}.byteplus-api.com` |
| 是 | 否 | `{Service}.byteplusapi.com` |
| 否 | 是 | `{Service}.{region}.byteplus-api.com` |
| 否 | 否 | `{Service}.{region}.byteplusapi.com` |

标准寻址不会追加 Go China 的 `.cn` 后缀，如需 `.cn` 请使用默认寻址（或显式指定 Endpoint）。

---

[← 访问凭据](1-Credentials-zh.md) | Endpoint 配置 [(English)](2-Endpoint.md) | [Transport →](3-Transport-zh.md)

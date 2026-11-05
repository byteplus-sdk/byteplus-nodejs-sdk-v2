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

   是否 GoChina 由服务侧决定，不可修改。匹配前会先对 region 做 `toLowerCase()` 归一化，因此 `CN-Beijing` 与 `cn-beijing` 等价；带首尾空白的 region（如 `  cn-beijing  `）不再被 trim，会直接抛出 `InvalidRegion`，参见 [region / service 合法性校验](#region--service-合法性校验)。

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

##### 代码示例

```typescript
import { ECSClient } from "@byteplus/ecs";

// SDK 会自动推导 Endpoint 为: ecs.ap-southeast-1.byteplus-api.com（DualStack 后缀）
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
    // err.service 携带缺失的服务名。
    // 请升级 SDK 依赖，或通过 `host` 显式指定 Endpoint。
    throw err;
  }
  throw err;
}
```

遇到该情况时，建议先升级 SDK 版本；若确认 SDK 尚未内置该服务，可通过 `host` 显式指定 Endpoint。

##### region / service 合法性校验

region 和 service 会被拼进 Endpoint 主机名并进入签名的 credential scope。为防止 Endpoint 注入（SSRF），SDK 要求它们必须是单个主机名标签：

- 只能包含 ASCII 字母、数字、`-` 和 `_`；
- 以字母开头，且不以 `-` 或 `_` 结尾（等价正则：`^[A-Za-z]([A-Za-z0-9_-]*[A-Za-z0-9])?$`）；
- 空字符串、`undefined`、`null` 视为未设置，不做校验（客户端未配置 `region` 时使用默认值 `ap-southeast-1`）；
- 非字符串值按 `String()` 转换后再校验，例如数字 `123` 会因不以字母开头被拒绝。

校验时机与覆盖入口：

- `Client.send` / `Client.presign`：未显式设置 `host` 时，在整个中间件栈（寻址、取凭证、签名以及自定义中间件）执行之前校验，非法值不会触发凭证解析，也不会发出请求。
- 默认 Endpoint 解析：`resolveDefaultEndpoint` 和 `getDefaultEndpointByServiceInfo` 都在所有分支之前校验，因此非法值不会回退到默认 open endpoint。在 `resolveDefaultEndpoint` 中，非法值优先于 `ServiceEndpointInfoMissingError` 抛出（只有 `resolveDefaultEndpoint` 会抛出这个错误）；`getDefaultEndpointByServiceInfo` 遇到非法值时，原样抛出校验产生的 `EndpointValidationError`，不做包装。
- RDS `buildAuthToken`：无论是否设置 `host` 都会校验 `region`（该入口会把 `host` 写入 `X-HOST` 后清空 `host`、按 `region` 自动寻址），且在改写 `client.config` 之前校验。
- CLI 配置文件的 SSO 模式：在使用 profile 内联 STS 凭证缓存、以及请求 `cloudidentity` 服务（主机名包含 region）之前，先校验 SSO region。

显式设置 `host` 时（RDS `buildAuthToken` 除外），SDK 不使用 region / service 拼接主机名，因此跳过上述校验。

校验失败时抛出 `EndpointValidationError`（继承自 `Error`，`name` 为 `"EndpointValidationError"`），通过 `code` 区分错误码 `ErrCodeInvalidRegion`（`"InvalidRegion"`）和 `ErrCodeInvalidService`（`"InvalidService"`）。`message` 形如：

```text
invalid region "ap-southeast-1@127.0.0.1": illegal character at index 14, region must start with a letter, end with a letter or digit, and contain only letters, digits, '-' and '_'
```

`EndpointValidationError`、`ErrCodeInvalidRegion`、`ErrCodeInvalidService` 以及校验函数 `validateRegion`、`validateService`、`validateServiceAndRegion` 均从 `@byteplus/sdk-core` 导出，校验函数也可用于提前校验外部输入。

```typescript
import {
  EndpointValidationError,
  ErrCodeInvalidRegion,
  ErrCodeInvalidService,
} from "@byteplus/sdk-core";

try {
  await client.send(command);
} catch (err) {
  if (err instanceof EndpointValidationError) {
    if (err.code === ErrCodeInvalidRegion) {
      // region 非法，例如 "ap-southeast-1@127.0.0.1" 或 "  ap-southeast-1  "
    } else if (err.code === ErrCodeInvalidService) {
      // service 非法
    }
  }
  throw err;
}
```

> **与旧版本不同**
>
> - 带首尾空白的 region（如 `"  cn-beijing  "`）不再自动 trim，改为直接抛出 `InvalidRegion`。此前这类值寻址时被 trim，但签名 credential scope 使用原值，请求本就会被服务端以 `InvalidAuthorization` 拒绝。从 CLI 配置文件读取的 region 仍会先 trim，不受影响。
> - CLI 配置 SSO 模式下，region 校验提前到使用 profile 内联 STS 临时凭证之前。此前凭证未过期时会直接返回、不校验 region，凭证过期后才因 region 非法而抛错；现在 region 非法会立即抛错。缓存命中本身不发请求，不涉及 SSRF，仅让配置错误尽早暴露。

---

[← 访问凭据](1-Credentials-zh.md) | Endpoint 配置 [(English)](2-Endpoint.md) | [Transport →](3-Transport-zh.md)

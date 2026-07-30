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

   - 服务未在映射中登记：Client 使用的默认寻址链路会**回退到默认 open endpoint** `open.ap-southeast-1.byteplusapi.com`，以保证请求不崩溃；而内部的 `resolveDefaultEndpoint` 解析器则会抛出 `ServiceEndpointInfoMissingError`（从 `@byteplus/sdk-core` 导出），错误消息形如 `byteplus-sdk: service endpoint info missing: service '<xxx>' not registered`。参见 [未知服务](#未知服务)。

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

##### 代码示例

```typescript
import { ECSClient } from "@byteplus/ecs";

// SDK 会自动推导 Endpoint 为: ecs.ap-southeast-1.byteplus-api.com（DualStack 后缀）
const client = new ECSClient({
  region: "ap-southeast-1",
  useDualStack: true, // 启用双栈；也可通过环境变量 BYTEPLUS_ENABLE_DUALSTACK=true 启用
});
```

##### 未知服务

对于未登记的服务，两条代码路径的行为不同（与实现保持一致）：

- **默认 Client 链路**（`getDefaultEndpointByServiceInfo`，由 endpoint 中间件使用）：**不会抛错**。为兼容旧调用方，它会回退到默认 open endpoint `open.ap-southeast-1.byteplusapi.com`（该回退会忽略 `region` / `useDualStack`）。如果某个请求意外发往 `open.ap-southeast-1.byteplusapi.com`，通常意味着当前安装的 SDK 尚未内置该服务。
- **内部解析器**（`resolveDefaultEndpoint`）：对未登记服务会抛出 `ServiceEndpointInfoMissingError`。包根只导出了该错误类，因此按类型匹配即可：

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

> 注意：`resolveDefaultEndpoint` 本身是内部函数，**未**从包根导出，包根只导出 `ServiceEndpointInfoMissingError`。由于默认 Client 请求链路走的是上述兜底包装，实际上 `client.send()` 对未知服务**不会**抛出该错误——而是静默指向 open endpoint。

---

[← 访问凭据](1-Credentials-zh.md) | Endpoint 配置 [(English)](2-Endpoint.md) | [Transport →](3-Transport-zh.md)

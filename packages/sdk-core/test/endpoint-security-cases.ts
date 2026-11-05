// 端点安全测试共用样本：只使用虚构地址，测试中不发起真实网络请求。
export type Field = "service" | "region";

export const RULE =
  "must start with a letter, end with a letter or digit, and contain only letters, digits, '-' and '_'";

// [输入, 期望的转义输出, 期望原因]
export const injectionCases: ReadonlyArray<readonly [string, string, string]> = [
  ["cn-beijing@127.0.0.1", '"cn-beijing@127.0.0.1"', "illegal character at index 10"],
  ["cn-beijing:443", '"cn-beijing:443"', "illegal character at index 10"],
  ["cn/beijing", '"cn/beijing"', "illegal character at index 2"],
  ["cn?beijing", '"cn?beijing"', "illegal character at index 2"],
  ["cn#beijing", '"cn#beijing"', "illegal character at index 2"],
  ["cn beijing", '"cn beijing"', "illegal character at index 2"],
  ["cn\tbeijing", '"cn\\tbeijing"', "illegal character at index 2"],
  ["cn\nbeijing", '"cn\\nbeijing"', "illegal character at index 2"],
  ["cn\rbeijing", '"cn\\rbeijing"', "illegal character at index 2"],
  ["cn\x00beijing", '"cn\\x00beijing"', "illegal character at index 2"],
  ["evil.com", '"evil.com"', "illegal character at index 4"],
  ["cn%2fbeijing", '"cn%2fbeijing"', "illegal character at index 2"],
  ["cn\\beijing", '"cn\\\\beijing"', "illegal character at index 2"],
  ["北京", '"北京"', "illegal character at index 0"],
  ["cn-北京", '"cn-北京"', "illegal character at index 3"],
  ["cn-beijing\n", '"cn-beijing\\n"', "illegal character at index 10"],
];

export const START_REASON = "must start with a letter";
export const END_REASON = "must not end with '-' or '_'";

export const boundaryCases: ReadonlyArray<readonly [string, string, string]> = [
  ["1cn-beijing", '"1cn-beijing"', START_REASON],
  ["1", '"1"', START_REASON],
  ["-cn-beijing", '"-cn-beijing"', START_REASON],
  ["_ecs", '"_ecs"', START_REASON],
  ["cn-beijing-", '"cn-beijing-"', END_REASON],
  ["rds_mysql_", '"rds_mysql_"', END_REASON],
  ["-", '"-"', START_REASON],
  ["_", '"_"', START_REASON],
];

export const invalidCases = [...injectionCases, ...boundaryCases];

export const validLabels = [
  "cn-beijing",
  "ap-southeast-1",
  "a",
  "rds_mysql",
  "Redis",
  "Rds_mysql-2",
  "",
];

export const LABEL_REGEX = /^[A-Za-z]([A-Za-z0-9_-]*[A-Za-z0-9])?$/;

export function codeOf(field: Field): string {
  return field === "service" ? "InvalidService" : "InvalidRegion";
}

export function messageOf(field: Field, quoted: string, reason: string): string {
  return `invalid ${field} ${quoted}: ${reason}, ${field} ${RULE}`;
}

export const testCredentials = {
  accessKeyId: "TEST_ACCESS_KEY",
  secretAccessKey: "TEST_SECRET_KEY",
  providerName: "endpoint-security-test",
};

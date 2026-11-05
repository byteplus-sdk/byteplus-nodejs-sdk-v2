/**
 * region / service 会被拼进 endpoint 主机名并进入签名 credential scope，
 * 这里统一校验它们只能是单个主机名标签，防止 endpoint 注入（SSRF）。
 * 等价正则：^[A-Za-z]([A-Za-z0-9_-]*[A-Za-z0-9])?$，空值放行由调用方处理。
 */

export const ErrCodeInvalidRegion = "InvalidRegion";
export const ErrCodeInvalidService = "InvalidService";

const ENDPOINT_LABEL_RULE =
  "must start with a letter, end with a letter or digit, " +
  "and contain only letters, digits, '-' and '_'";

/** region / service 校验失败时抛出的错误，可通过 code 区分 InvalidRegion / InvalidService。 */
export class EndpointValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "EndpointValidationError";
    this.code = code;
    Object.setPrototypeOf(this, EndpointValidationError.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, EndpointValidationError);
    }
  }

  Code(): string {
    return this.code;
  }

  Message(): string {
    return this.message;
  }

  override toString(): string {
    return `${this.code}: ${this.message}`;
  }
}

function isLetter(c: number): boolean {
  return (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a);
}

function isDigit(c: number): boolean {
  return c >= 0x30 && c <= 0x39;
}

function isEndpointLabelChar(c: number): boolean {
  return isLetter(c) || isDigit(c) || c === 0x2d || c === 0x5f;
}

// 返回不合法的原因，合法（含空串）返回空串；先查字符集，再查首尾。
function endpointLabelProblem(s: string): string {
  if (s.length === 0) {
    return "";
  }
  for (let i = 0; i < s.length; i++) {
    if (!isEndpointLabelChar(s.charCodeAt(i))) {
      return `illegal character at index ${i}`;
    }
  }
  if (!isLetter(s.charCodeAt(0))) {
    return "must start with a letter";
  }
  const last = s.charCodeAt(s.length - 1);
  if (last === 0x2d || last === 0x5f) {
    return "must not end with '-' or '_'";
  }
  return "";
}

// 按字符串拼接时的语义把非字符串转成字符串校验，null / undefined 视为空值。
function toLabel(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return String(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

const PRINTABLE = /^[\p{L}\p{M}\p{N}\p{P}\p{S}]$/u;

function hex(cp: number, width: number): string {
  return cp.toString(16).padStart(width, "0");
}

// 类似 Go 的 %q：转义引号、反斜杠、控制字符和不可打印字符。
function quote(s: string): string {
  let out = '"';
  for (const ch of s) {
    const cp = ch.codePointAt(0) as number;
    switch (ch) {
      case '"':
        out += '\\"';
        continue;
      case "\\":
        out += "\\\\";
        continue;
      case "\x07":
        out += "\\a";
        continue;
      case "\b":
        out += "\\b";
        continue;
      case "\f":
        out += "\\f";
        continue;
      case "\n":
        out += "\\n";
        continue;
      case "\r":
        out += "\\r";
        continue;
      case "\t":
        out += "\\t";
        continue;
      case "\v":
        out += "\\v";
        continue;
    }
    if (cp < 0x20 || cp === 0x7f) {
      out += "\\x" + hex(cp, 2);
    } else if (cp < 0x7f || PRINTABLE.test(ch)) {
      out += ch;
    } else if (cp <= 0xffff) {
      out += "\\u" + hex(cp, 4);
    } else {
      out += "\\U" + hex(cp, 8);
    }
  }
  return out + '"';
}

function validateEndpointLabel(value: unknown, field: string, code: string): void {
  const label = toLabel(value);
  const reason = endpointLabelProblem(label);
  if (reason !== "") {
    throw new EndpointValidationError(
      code,
      `invalid ${field} ${quote(label)}: ${reason}, ${field} ${ENDPOINT_LABEL_RULE}`,
    );
  }
}

/** 校验 region，非法时抛出 code 为 InvalidRegion 的 EndpointValidationError；空值放行。 */
export function validateRegion(region: string | null | undefined): void {
  validateEndpointLabel(region, "region", ErrCodeInvalidRegion);
}

/** 校验 service，非法时抛出 code 为 InvalidService 的 EndpointValidationError；空值放行。 */
export function validateService(service: string | null | undefined): void {
  validateEndpointLabel(service, "service", ErrCodeInvalidService);
}

/** 先校验 service 再校验 region。 */
export function validateServiceAndRegion(
  service: string | null | undefined,
  region: string | null | undefined,
): void {
  validateService(service);
  validateRegion(region);
}

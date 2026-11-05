import {
  EndpointValidationError,
  ErrCodeInvalidRegion,
  ErrCodeInvalidService,
  validateRegion,
  validateService,
  validateServiceAndRegion,
} from "../src/utils/endpoint-validation";
import * as publicApi from "../src/index";
import {
  END_REASON,
  Field,
  LABEL_REGEX,
  START_REASON,
  boundaryCases,
  codeOf,
  injectionCases,
  invalidCases,
  messageOf,
  validLabels,
} from "./endpoint-security-cases";

function captureError(fn: () => void): unknown {
  try {
    fn();
  } catch (err) {
    return err;
  }
  return undefined;
}

const validators: Record<Field, (v: any) => void> = {
  service: validateService,
  region: validateRegion,
};

describe("endpoint label validation", () => {
  test("is exported from the package entry", () => {
    expect(publicApi.validateRegion).toBe(validateRegion);
    expect(publicApi.validateService).toBe(validateService);
    expect(publicApi.validateServiceAndRegion).toBe(validateServiceAndRegion);
    expect(publicApi.EndpointValidationError).toBe(EndpointValidationError);
    expect(publicApi.ErrCodeInvalidRegion).toBe("InvalidRegion");
    expect(publicApi.ErrCodeInvalidService).toBe("InvalidService");
  });

  describe.each(["service", "region"] as const)("%s", (field) => {
    const validate = validators[field];

    test.each(injectionCases)("rejects injection %j", (value, quoted, reason) => {
      const err = captureError(() => validate(value)) as EndpointValidationError;
      expect(err).toBeInstanceOf(EndpointValidationError);
      expect(err.code).toBe(codeOf(field));
      expect(err.message).toBe(messageOf(field, quoted, reason));
    });

    test.each(boundaryCases)("rejects boundary %j", (value, quoted, reason) => {
      const err = captureError(() => validate(value)) as EndpointValidationError;
      expect(err).toBeInstanceOf(EndpointValidationError);
      expect(err.code).toBe(codeOf(field));
      expect(err.message).toBe(messageOf(field, quoted, reason));
    });

    test("asserts each of the three reasons exactly", () => {
      expect((captureError(() => validate("cn@x")) as Error).message).toBe(
        messageOf(field, '"cn@x"', "illegal character at index 2"),
      );
      expect((captureError(() => validate("9a")) as Error).message).toBe(
        messageOf(field, '"9a"', START_REASON),
      );
      expect((captureError(() => validate("a_")) as Error).message).toBe(
        messageOf(field, '"a_"', END_REASON),
      );
    });

    test("checks the character set before the first/last rules", () => {
      expect((captureError(() => validate("-a.")) as Error).message).toBe(
        messageOf(field, '"-a."', "illegal character at index 2"),
      );
      expect((captureError(() => validate("1a-")) as Error).message).toBe(
        messageOf(field, '"1a-"', START_REASON),
      );
    });

    test.each(validLabels)("accepts %j", (value) => {
      expect(() => validate(value)).not.toThrow();
    });

    test.each([null, undefined])("treats %p as empty", (value) => {
      expect(() => validate(value)).not.toThrow();
    });

    test("validates non-string input by its string form", () => {
      const num = captureError(() => validate(123)) as EndpointValidationError;
      expect(num.code).toBe(codeOf(field));
      expect(num.message).toBe(messageOf(field, '"123"', START_REASON));
      const obj = captureError(() => validate({})) as EndpointValidationError;
      expect(obj.code).toBe(codeOf(field));
      expect(obj.message).toBe(
        messageOf(field, '"[object Object]"', "illegal character at index 0"),
      );
      const bare = captureError(() => validate(Object.create(null))) as EndpointValidationError;
      expect(bare.code).toBe(codeOf(field));
      const sym = captureError(() => validate(Symbol("x"))) as EndpointValidationError;
      expect(sym.message).toBe(
        messageOf(field, '"Symbol(x)"', "illegal character at index 6"),
      );
      expect(() => validate(["a.b"])).toThrow(EndpointValidationError);
    });

    test("escapes the value like Go %q", () => {
      const cases: Array<[string, string]> = [
        ['a"b', '"a\\"b"'],
        ["a\x07\b\f\v", '"a\\a\\b\\f\\v"'],
        ["a\x1f", '"a\\x1f"'],
        ["a\x7f", '"a\\x7f"'],
        ["a\u0085", '"a\\u0085"'],
        ["a\u00a0", '"a\\u00a0"'],
        ["a\u2028", '"a\\u2028"'],
        ["a\ud800", '"a\\ud800"'],
        ["a\u{e0001}", '"a\\U000e0001"'],
        ["a\u00e9\u{1f600}", '"aé😀"'],
      ];
      for (const [value, quoted] of cases) {
        const err = captureError(() => validate(value)) as Error;
        expect(err.message).toBe(messageOf(field, quoted, "illegal character at index 1"));
      }
    });
  });

  test("validateServiceAndRegion checks service first, then region", () => {
    const both = captureError(() => validateServiceAndRegion("ecs.", "cn/")) as EndpointValidationError;
    expect(both.code).toBe(ErrCodeInvalidService);
    const region = captureError(() => validateServiceAndRegion("ecs", "cn/")) as EndpointValidationError;
    expect(region.code).toBe(ErrCodeInvalidRegion);
    expect(() => validateServiceAndRegion("", "")).not.toThrow();
    expect(() => validateServiceAndRegion(undefined, null)).not.toThrow();
    expect(() => validateServiceAndRegion("rds_mysql", "cn-beijing")).not.toThrow();
  });

  test("error exposes Code()/Message() and formats as 'Code: Message'", () => {
    const err = captureError(() => validateRegion("cn-beijing@127.0.0.1")) as EndpointValidationError;
    const message = messageOf("region", '"cn-beijing@127.0.0.1"', "illegal character at index 10");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(EndpointValidationError);
    expect(err.name).toBe("EndpointValidationError");
    expect(err.Code()).toBe("InvalidRegion");
    expect(err.Message()).toBe(message);
    expect(err.toString()).toBe(`InvalidRegion: ${message}`);
    expect(String(err)).toBe(`InvalidRegion: ${message}`);
    expect(err.stack).toContain(message);
  });

  test.each(["service", "region"] as const)(
    "%s matches the reference regex for every 1- and 2-byte input",
    (field) => {
      const validate = validators[field];
      const check = (s: string) => {
        const err = captureError(() => validate(s)) as EndpointValidationError | undefined;
        const expectedValid = s === "" || LABEL_REGEX.test(s);
        if (expectedValid !== (err === undefined)) {
          throw new Error(`mismatch for ${JSON.stringify(s)}: ${String(err)}`);
        }
        if (err) {
          expect(err.code).toBe(codeOf(field));
          expect(err.message).toMatch(
            /: (illegal character at index \d+|must start with a letter|must not end with '-' or '_'), /,
          );
        }
      };
      const alphabet: string[] = [];
      for (let b = 0; b < 256; b++) alphabet.push(String.fromCharCode(b));
      alphabet.push("Ā", "中", "\ud800", "ａ");
      check("");
      for (const a of alphabet) {
        check(a);
        for (const b of alphabet) check(a + b);
      }
    },
  );

  test("all invalid samples are rejected by the reference regex too", () => {
    for (const [value] of invalidCases) {
      expect(LABEL_REGEX.test(value)).toBe(false);
    }
    for (const value of validLabels.filter((v) => v !== "")) {
      expect(LABEL_REGEX.test(value)).toBe(true);
    }
  });
});

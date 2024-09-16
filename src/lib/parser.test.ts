import { describe, expect, test } from "bun:test";
import * as parser from "./parser.js";

describe(parser.parse.name, () => {
	test("should correctly parse the language with quality", () => {
		let [result] = parser.parse("en-GB;q=0.8");
		expect(result).toEqual({
			code: "en",
			region: "GB",
			quality: 0.8,
			script: null,
		});
	});

	test("should correctly parse the language without quality (default 1)", () => {
		let [result] = parser.parse("en-GB");
		expect(result).toEqual({
			code: "en",
			region: "GB",
			quality: 1.0,
			script: null,
		});
	});

	test("should correctly parse the language without region", () => {
		let [result] = parser.parse("en;q=0.8");
		expect(result).toEqual({ code: "en", quality: 0.8, script: null });
	});

	test("should ignore extra characters in the region code", () => {
		let [result] = parser.parse("az-AZ");
		expect(result).toEqual({
			code: "az",
			region: "AZ",
			quality: 1.0,
			script: null,
		});
	});

	test("should correctly parse a multi-language set", () => {
		let result = parser.parse("fr-CA,fr;q=0.8");
		expect(result).toEqual([
			{ code: "fr", region: "CA", quality: 1.0, script: null },
			{ code: "fr", quality: 0.8, script: null },
		]);
	});

	test("should correctly parse a wildcard", () => {
		let result = parser.parse("fr-CA,*;q=0.8");
		expect(result).toEqual([
			{ code: "fr", region: "CA", quality: 1.0, script: null },
			{ code: "*", quality: 0.8, script: null },
		]);
	});

	test("should correctly parse a region with numbers", () => {
		let [result] = parser.parse("fr-150");
		expect(result).toEqual({
			code: "fr",
			region: "150",
			quality: 1.0,
			script: null,
		});
	});

	test("should correctly parse complex set", () => {
		let result = parser.parse("fr-CA,fr;q=0.8,en-US;q=0.6,en;q=0.4,*;q=0.1");
		expect(result).toEqual([
			{ code: "fr", region: "CA", quality: 1.0, script: null },
			{ code: "fr", quality: 0.8, script: null },
			{ code: "en", region: "US", quality: 0.6, script: null },
			{ code: "en", quality: 0.4, script: null },
			{ code: "*", quality: 0.1, script: null },
		]);
	});

	test("should cope with random whitespace", () => {
		let result = parser.parse(
			"fr-CA, fr;q=0.8,  en-US;q=0.6,en;q=0.4,    *;q=0.1",
		);
		expect(result).toEqual([
			{ code: "fr", region: "CA", quality: 1.0, script: null },
			{ code: "fr", quality: 0.8, script: null },
			{ code: "en", region: "US", quality: 0.6, script: null },
			{ code: "en", quality: 0.4, script: null },
			{ code: "*", quality: 0.1, script: null },
		]);

		let result2 = parser.parse("zh-CN, zh; q=0.9, en; q=0.8, ko; q=0.7");

		expect(result2).toEqual([
			{ code: "zh", region: "CN", quality: 1.0, script: null },
			{ code: "zh", quality: 0.9, script: null },
			{ code: "en", quality: 0.8, script: null },
			{ code: "ko", quality: 0.7, script: null },
		]);
	});

	test("should sort based on quality value", () => {
		let result = parser.parse("fr-CA,fr;q=0.2,en-US;q=0.6,en;q=0.4,*;q=0.5");
		expect(result).toEqual([
			{ code: "fr", region: "CA", quality: 1.0, script: null },
			{ code: "en", region: "US", quality: 0.6, script: null },
			{ code: "*", quality: 0.5, script: null },
			{ code: "en", quality: 0.4, script: null },
			{ code: "fr", quality: 0.2, script: null },
		]);
	});

	test("should correctly identify script", () => {
		let [result] = parser.parse("zh-Hant-cn");
		expect(result).toEqual({
			code: "zh",
			script: "Hant",
			region: "cn",
			quality: 1.0,
		});
	});

	test("should cope with script and a quality value", () => {
		let result = parser.parse("zh-Hant-cn;q=1, zh-cn;q=0.6, zh;q=0.4");
		expect(result).toEqual([
			{ code: "zh", script: "Hant", region: "cn", quality: 1.0 },
			{ code: "zh", region: "cn", quality: 0.6, script: null },
			{ code: "zh", quality: 0.4, script: null },
		]);
	});
});

describe(parser.pick.name, () => {
	test("should pick a specific regional language", () => {
		let result = parser.pick(
			["en-US", "fr-CA"],
			"fr-CA,fr;q=0.2,en-US;q=0.6,en;q=0.4,*;q=0.5",
		);
		expect(result).toEqual("fr-CA");
	});

	test("should pick a specific regional language when accept-language is parsed", () => {
		let result = parser.pick(
			["en-US", "fr-CA"],
			parser.parse("fr-CA,fr;q=0.2,en-US;q=0.6,en;q=0.4,*;q=0.5"),
		);
		expect(result).toEqual("fr-CA");
	});

	test("should pick a specific script (if specified)", () => {
		let result = parser.pick(
			["zh-Hant-cn", "zh-cn"],
			"zh-Hant-cn,zh-cn;q=0.6,zh;q=0.4",
		);
		expect(result).toEqual("zh-Hant-cn");
	});

	test("should pick proper language regardless of casing", () => {
		let result = parser.pick(
			["eN-Us", "Fr-cA"],
			"fR-Ca,fr;q=0.2,en-US;q=0.6,en;q=0.4,*;q=0.5",
		);
		if (result === null) throw new Error("Result is null");
		expect(result.toLowerCase()).toEqual("fr-ca");
	});

	test("should pick a specific language", () => {
		let result = parser.pick(["en", "fr-CA"], "ja-JP,ja;1=0.5,en;q=0.2");
		expect(result).toEqual("en");
	});

	test("should pick a language when culture is not specified", () => {
		let result = parser.pick(["en-us", "it-IT"], "pl-PL,en");
		expect(result).toEqual("en-us");
	});

	test("should return null if no matches are found", () => {
		let result = parser.pick(
			["ko-KR"],
			"fr-CA,fr;q=0.8,en-US;q=0.6,en;q=0.4,*;q=0.1",
		);
		expect(result).toEqual(null);
	});

	test("should return null if support no languages", () => {
		let result = parser.pick([], "fr-CA,fr;q=0.8,en-US;q=0.6,en;q=0.4,*;q=0.1");
		expect(result).toEqual(null);
	});

	test("by default should be strict when selecting language", () => {
		let result = parser.pick(["en", "pl"], "en-US;q=0.6");
		expect(result).toEqual(null);
	});

	test("can select language loosely with an option", () => {
		let result = parser.pick(["en", "pl"], "en-US;q=0.6", { loose: true });
		expect(result).toEqual("en");
	});

	test("selects most matching language in loose mode", () => {
		let result = parser.pick(["en-US", "en", "pl"], "en-US;q=0.6", {
			loose: true,
		});
		expect(result).toEqual("en-US");
	});
});

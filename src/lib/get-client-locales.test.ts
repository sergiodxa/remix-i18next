import { describe, expect, test } from "bun:test";
import * as getClientLocales from "./get-client-locales.js";

describe(getClientLocales.getClientLocales.name, () => {
	test("should not throw on invalid locales", () => {
		let headers = new Headers();
		headers.set(
			"Accept-Language",
			"cs-CZ,cs;q=0.9,true;q=0.8,en-US;q=0.7,en;q=0.6",
		);
		expect(() => getClientLocales.getClientLocales(headers)).not.toThrowError(
			RangeError,
		);
	});
});

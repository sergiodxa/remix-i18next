import { describe, expect, test } from "bun:test";

import { unstable_RouterContextProvider } from "react-router";
import { runMiddleware } from "./lib/test-helper";
import { unstable_createI18nextMiddleware } from "./middleware";

describe(unstable_createI18nextMiddleware.name, () => {
	test("sets the locale in context", async () => {
		let [middleware, getLocale] = unstable_createI18nextMiddleware({
			detection: { fallbackLanguage: "en", supportedLanguages: ["es", "en"] },
		});

		let context = new unstable_RouterContextProvider();
		await runMiddleware(middleware, { context });

		expect(getLocale(context)).toBe("en");
	});

	test("detects locale from request and saves it in context", async () => {
		let [middleware, getLocale] = unstable_createI18nextMiddleware({
			detection: { fallbackLanguage: "en", supportedLanguages: ["es", "en"] },
		});

		let request = new Request("http://example.com", {
			headers: { "Accept-Language": "es" },
		});

		let context = new unstable_RouterContextProvider();

		await runMiddleware(middleware, { request, context });

		expect(getLocale(context)).toBe("es");
	});

	test("can access i18next instance", async () => {
		let [middleware, , getInstance] = unstable_createI18nextMiddleware({
			detection: { fallbackLanguage: "en", supportedLanguages: ["es", "en"] },
		});

		let context = new unstable_RouterContextProvider();
		await runMiddleware(middleware, { context });

		let instance = getInstance(context);

		expect(instance).toBeDefined();
		expect(instance.isInitialized).toBe(true);
	});

	test("can access TFunction from instance", async () => {
		let [middleware, , getInstance] = unstable_createI18nextMiddleware({
			detection: { fallbackLanguage: "en", supportedLanguages: ["es", "en"] },
			i18next: {
				resources: { en: { translation: { key: "value" } } },
			},
		});

		let context = new unstable_RouterContextProvider();
		await runMiddleware(middleware, { context });

		expect(getInstance(context).t("key")).toBe("value");
	});

	test("the instance has the detected locale configured", async () => {
		let [middleware, getLocale, getInstance] = unstable_createI18nextMiddleware(
			{
				detection: {
					fallbackLanguage: "en",
					supportedLanguages: ["es", "en"],
				},
			},
		);

		let request = new Request("http://example.com", {
			headers: { "Accept-Language": "es" },
		});

		let context = new unstable_RouterContextProvider();

		await runMiddleware(middleware, { request, context });

		expect(getLocale(context)).toBe("es");
		expect(getInstance(context).language).toBe("es");
	});
});

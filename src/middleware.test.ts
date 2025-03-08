import { describe, expect, mock, test } from "bun:test";

import { unstable_RouterContextProvider } from "react-router";
import { unstable_createI18nextMiddleware } from "./middleware";
import { RemixI18Next } from "./server";

describe(unstable_createI18nextMiddleware.name, () => {
	let i18n = new RemixI18Next({
		detection: {
			supportedLanguages: ["es", "en"],
			fallbackLanguage: "en",
		},
		i18next: {
			resources: {
				en: { translation: { hello: "Hello" } },
				es: { translation: { hello: "Hola" } },
			},
		},
	});

	test("returns an array with three functions", () => {
		let result = unstable_createI18nextMiddleware(i18n);
		expect(result).toBeArray();
		expect(result).toHaveLength(3);
		expect(result[0]).toBeFunction();
		expect(result[1]).toBeFunction();
	});

	test("loaders the locale from the context", async () => {
		let [middleware, _, getLocale] = unstable_createI18nextMiddleware(i18n);

		let context = new unstable_RouterContextProvider();
		let request = new Request("https://remix.i18next");
		let next = mock().mockImplementation(() => {
			let locale = getLocale(context);
			return Response.json(locale);
		});

		let response = await middleware({ request, context, params: {} }, next);

		expect(response.json()).resolves.toBe("en");
	});

	test("loaders can get a TFunction", async () => {
		let [middleware, getFixedT] = unstable_createI18nextMiddleware(i18n);

		let context = new unstable_RouterContextProvider();
		let request = new Request("https://remix.i18next?lng=es");
		let next = mock().mockImplementation(async () => {
			let t = await getFixedT(context);
			return Response.json(t("hello"));
		});

		let response = await middleware({ request, context, params: {} }, next);

		expect(response.json()).resolves.toBe("Hola");
	});
});

import { createCookie } from "remix";
import { RemixI18Next } from "../src";
import { Backend } from "../src/backend";

class TestBackend implements Backend {
  async getTranslations() {
    return {};
  }
}

describe(RemixI18Next, () => {
  describe("getLocale", () => {
    test("should get the locale from the search param ?lng", async () => {
      let request = new Request("https://example.com/dashboard?lng=es");
      let i18n = new RemixI18Next(new TestBackend(), {
        supportedLanguages: ["es", "en"],
        fallbackLng: "en",
      });
      expect(await i18n.getLocale(request)).toBe("es");
    });

    test("should get the locale from the cookie", async () => {
      let cookie = createCookie("locale");
      let request = new Request("https://example.com/dashboard", {
        headers: { Cookie: await cookie.serialize("es") },
      });
      let i18n = new RemixI18Next(new TestBackend(), {
        supportedLanguages: ["es", "en"],
        fallbackLng: "en",
        cookie,
      });
      expect(await i18n.getLocale(request)).toBe("es");
    });

    test("should get the locale from the request header", async () => {
      let request = new Request("https://example.com/dashboard", {
        headers: { "Accept-Language": "es" },
      });
      let i18n = new RemixI18Next(new TestBackend(), {
        supportedLanguages: ["es", "en"],
        fallbackLng: "en",
      });
      expect(await i18n.getLocale(request)).toBe("es");
    });

    test("should use the fallback language if search param, cookie and request headers are not there", async () => {
      let request = new Request("https://example.com/dashboard");
      let i18n = new RemixI18Next(new TestBackend(), {
        supportedLanguages: ["es", "en"],
        fallbackLng: "en",
      });
      expect(await i18n.getLocale(request)).toBe("en");
    });

    test("should use the fallback language if the expected one is not supported", async () => {
      let request = new Request("https://example.com/dashboard?lng=fr");
      let i18n = new RemixI18Next(new TestBackend(), {
        supportedLanguages: ["es", "en"],
        fallbackLng: "en",
      });
      expect(await i18n.getLocale(request)).toBe("en");
    });

    test("should prefer search params over cookie and header", async () => {
      let cookie = createCookie("locale");
      let request = new Request("https://example.com/dashboard?lng=es", {
        headers: {
          "Accept-Language": "fr",
          Cookie: await cookie.serialize("jp"),
        },
      });
      let i18n = new RemixI18Next(new TestBackend(), {
        supportedLanguages: ["es", "fr", "jp", "en"],
        fallbackLng: "en",
        cookie,
      });
      expect(await i18n.getLocale(request)).toBe("es");
    });

    test("should prefer cookie over header", async () => {
      let cookie = createCookie("locale");
      let request = new Request("https://example.com/dashboard", {
        headers: {
          "Accept-Language": "fr",
          Cookie: await cookie.serialize("jp"),
        },
      });
      let i18n = new RemixI18Next(new TestBackend(), {
        supportedLanguages: ["es", "fr", "jp", "en"],
        fallbackLng: "en",
        cookie,
      });
      expect(await i18n.getLocale(request)).toBe("jp");
    });
  });
});

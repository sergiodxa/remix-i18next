import { createCookie, createMemorySessionStorage } from "@remix-run/node";
import { describe, expect, test } from "vitest";
import { RemixI18Next } from "../src";

describe(RemixI18Next.name, () => {
  describe("getLocale", () => {
    test("should get the locale from the search param ?lng", async () => {
      let request = new Request("https://example.com/dashboard?lng=es");

      let i18n = new RemixI18Next({
        detection: {
          supportedLanguages: ["es", "en"],
          fallbackLanguage: "en",
        },
      });

      expect(await i18n.getLocale(request)).toBe("es");
    });

    test("should get the locale from the cookie", async () => {
      let cookie = createCookie("locale");

      let request = new Request("https://example.com/dashboard", {
        headers: { Cookie: await cookie.serialize("es") },
      });

      let i18n = new RemixI18Next({
        detection: {
          supportedLanguages: ["es", "en"],
          fallbackLanguage: "en",
          cookie,
        },
      });

      expect(await i18n.getLocale(request)).toBe("es");
    });

    test("should get the locale from the Session", async () => {
      let sessionStorage = createMemorySessionStorage({
        cookie: { name: "session", secrets: ["s3cr3t"] },
      });

      let session = await sessionStorage.getSession();
      session.set("lng", "es");

      let request = new Request("https://example.com/dashboard", {
        headers: { Cookie: await sessionStorage.commitSession(session) },
      });

      let i18n = new RemixI18Next({
        detection: {
          supportedLanguages: ["es", "en"],
          fallbackLanguage: "en",
          sessionStorage,
        },
      });

      expect(await i18n.getLocale(request)).toBe("es");
    });

    test("should get the locale from the Session using a different key", async () => {
      let sessionKey = "locale";
      let sessionStorage = createMemorySessionStorage({
        cookie: { name: "session", secrets: ["s3cr3t"] },
      });

      let session = await sessionStorage.getSession();
      session.set(sessionKey, "es");

      let request = new Request("https://example.com/dashboard", {
        headers: { Cookie: await sessionStorage.commitSession(session) },
      });

      let i18n = new RemixI18Next({
        detection: {
          supportedLanguages: ["es", "en"],
          fallbackLanguage: "en",
          sessionStorage,
          sessionKey,
        },
      });

      expect(await i18n.getLocale(request)).toBe("es");
    });

    test("should get the locale from the request header", async () => {
      let request = new Request("https://example.com/dashboard", {
        headers: { "Accept-Language": "es" },
      });

      let i18n = new RemixI18Next({
        detection: {
          supportedLanguages: ["es", "en"],
          fallbackLanguage: "en",
        },
      });

      expect(await i18n.getLocale(request)).toBe("es");
    });

    test("should use the fallback language if search param, cookie and request headers are not there", async () => {
      let request = new Request("https://example.com/dashboard");

      let i18n = new RemixI18Next({
        detection: {
          supportedLanguages: ["es", "en"],
          fallbackLanguage: "en",
        },
      });

      expect(await i18n.getLocale(request)).toBe("en");
    });

    test("should use the fallback language if the expected one is not supported", async () => {
      let request = new Request("https://example.com/dashboard?lng=fr");

      let i18n = new RemixI18Next({
        detection: {
          supportedLanguages: ["es", "en"],
          fallbackLanguage: "en",
        },
      });

      expect(await i18n.getLocale(request)).toBe("en");
    });

    test("should prefer search params over cookie, session and header", async () => {
      let cookie = createCookie("locale");

      let sessionStorage = createMemorySessionStorage({
        cookie: { name: "session", secrets: ["s3cr3t"] },
      });

      let session = await sessionStorage.getSession();
      session.set("lng", "en");

      let headers = new Headers();
      headers.set("Accept-Language", "fr");
      headers.append("Cookie", await cookie.serialize("jp"));
      headers.append("Cookie", await sessionStorage.commitSession(session));

      let request = new Request("https://example.com/dashboard?lng=es", {
        headers,
      });

      let i18n = new RemixI18Next({
        detection: {
          supportedLanguages: ["es", "fr", "jp", "en"],
          fallbackLanguage: "en",
          sessionStorage,
          cookie,
        },
      });

      expect(await i18n.getLocale(request)).toBe("es");
    });

    test("should prefer cookie over session and header", async () => {
      let cookie = createCookie("locale");

      let request = new Request("https://example.com/dashboard", {
        headers: {
          "Accept-Language": "fr",
          Cookie: await cookie.serialize("jp"),
        },
      });

      let i18n = new RemixI18Next({
        detection: {
          supportedLanguages: ["es", "fr", "jp", "en"],
          fallbackLanguage: "en",
          cookie,
        },
      });

      expect(await i18n.getLocale(request)).toBe("jp");
    });

    test("should prefer session over header", async () => {
      let sessionStorage = createMemorySessionStorage({
        cookie: { name: "session", secrets: ["s3cr3t"] },
      });

      let session = await sessionStorage.getSession();
      session.set("lng", "jp");

      let request = new Request("https://example.com/dashboard", {
        headers: {
          "Accept-Language": "fr",
          Cookie: await sessionStorage.commitSession(session),
        },
      });

      let i18n = new RemixI18Next({
        detection: {
          supportedLanguages: ["es", "fr", "jp", "en"],
          fallbackLanguage: "en",
          sessionStorage,
        },
      });

      expect(await i18n.getLocale(request)).toBe("jp");
    });

    test("allow changing the order", async () => {
      let cookie = createCookie("locale");

      let sessionStorage = createMemorySessionStorage({
        cookie: { name: "session", secrets: ["s3cr3t"] },
      });

      let session = await sessionStorage.getSession();
      session.set("lng", "en");

      let headers = new Headers();
      headers.set("Accept-Language", "fr");
      headers.append("Cookie", await sessionStorage.commitSession(session));
      headers.append("Cookie", await cookie.serialize("jp"));

      let request = new Request("https://example.com/dashboard?lng=es", {
        headers,
      });

      let i18n = new RemixI18Next({
        detection: {
          supportedLanguages: ["es", "fr", "jp", "en"],
          fallbackLanguage: "en",
          sessionStorage,
          cookie,
          order: ["session", "cookie", "header", "searchParams"],
        },
      });

      expect(await i18n.getLocale(request)).toBe("en");
    });

    test("return the specific locale if there are multiple variants", async () => {
      let request = new Request("https://example.com/dashboard?lng=es-MX");

      let i18n = new RemixI18Next({
        detection: {
          supportedLanguages: ["es", "en", "es-MX"],
          fallbackLanguage: "en",
        },
      });

      expect(await i18n.getLocale(request)).toBe("es-MX");
    });
  });

  describe("getFixedT", () => {
    test("get a fixed T function for server-side usage", async () => {
      let headers = new Headers();
      headers.set("Accept-Language", "fr");

      let request = new Request("https://example.com/dashboard?lng=1", {
        headers,
      });

      let i18n = new RemixI18Next({
        detection: {
          supportedLanguages: ["es", "fr", "jp", "en"],
          fallbackLanguage: "en",
          order: ["session", "cookie", "header", "searchParams"],
        },
        i18next: {
          fallbackNS: "common",
          defaultNS: "common",
          resources: {
            fr: {
              common: {
                "Hello {{name}}": "Bonjour {{name}}",
              },
            },
          },
        },
      });

      let t = await i18n.getFixedT(request, "common");

      expect(t("Hello {{name}}", { name: "Remix" })).toBe("Bonjour Remix");
    });
  });
});

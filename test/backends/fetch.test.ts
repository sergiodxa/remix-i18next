import fetchMock, { enableFetchMocks } from "jest-fetch-mock";
import { FetchBackend, FetchBackendOptions } from "../../src/backends/fetch";

enableFetchMocks();

describe(FetchBackend, () => {
  afterEach(() => {
    fetchMock.resetMocks();
  });

  it("should use the baseUrl and pathPattern to define the request URL", async () => {
    let options: FetchBackendOptions = {
      baseUrl: new URL("https://api.example.com"),
      pathPattern: "/i18n/:locale/:namespace",
    };

    let backend = new FetchBackend(options);

    fetchMock.once("{}");

    await backend.getTranslations("common", "en");

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.example.com/i18n/en/common"
    );
  });

  test("should support patterns with tokens no the query string", async () => {
    let options: FetchBackendOptions = {
      baseUrl: new URL("https://api.example.com"),
      pathPattern: "/i18n?locale=:locale&ns=:namespace",
    };

    let backend = new FetchBackend(options);

    fetchMock.once("{}");

    await backend.getTranslations("common", "en");

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.example.com/i18n?locale=en&ns=common"
    );
  });

  test("should add the Accept header by default", async () => {
    let options: FetchBackendOptions = {
      baseUrl: new URL("https://api.example.com"),
      pathPattern: "/i18n/:locale/:namespace",
    };

    let backend = new FetchBackend(options);

    fetchMock.once("{}");

    await backend.getTranslations("common", "en");

    expect(fetchMock.mock.calls[0][1].headers).toEqual(
      new Headers({ Accept: "application/json" })
    );
  });

  test("should allow adding extra headers", async () => {
    let options: FetchBackendOptions = {
      baseUrl: new URL("https://api.example.com"),
      pathPattern: "/i18n/:locale/:namespace",
      headers: { Authorization: "token=test" },
    };

    let backend = new FetchBackend(options);

    fetchMock.once("{}");

    await backend.getTranslations("common", "en");

    expect(fetchMock.mock.calls[0][1].headers).toEqual(
      new Headers({ Accept: "application/json", Authorization: "token=test" })
    );
  });

  test("should allow overwriting the Accept header", async () => {
    let options: FetchBackendOptions = {
      baseUrl: new URL("https://api.example.com"),
      pathPattern: "/i18n/:locale/:namespace",
      headers: { Accept: "application/json; charset=utf-8" },
    };

    let backend = new FetchBackend(options);

    fetchMock.once("{}");

    await backend.getTranslations("common", "en");

    expect(fetchMock.mock.calls[0][1].headers).toEqual(
      new Headers({ Accept: "application/json; charset=utf-8" })
    );
  });
});

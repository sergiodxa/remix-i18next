import { pick } from "accept-language-parser";
import type { Cookie, SessionStorage } from "remix";
import type { Backend, Language } from "./backend";

interface RemixI18NextOptions {
  /**
   * Define the list of supported languages, this is used to determine if one of
   * the languages requested by the user is supported by the application.
   * This should be be same as the supportedLngs in the i18next options.
   */
  supportedLanguages: string[];
  /**
   * Define the fallback language that it's going to be used in the case user
   * expected language is not supported.
   * This should be be same as the fallbackLng in the i18next options.
   */
  fallbackLng: string;
  /**
   * A class that implements the Cache interface and is used to store the
   * languages, in production, between requests to avoid loading them multiple
   * times, this is used so the user doesn't have to wait for the backend to
   * retrieve the translations every time.
   * By default, remix-i18next uses an in memory cache based on an ES Map
   * instance.
   */
  cache?: Cache;
  /**
   * If enabled, the cache will be used even in development mode.
   * This is disabled by default so while you code the languages are going to
   * be requested again on every request and be up-to-date.
   * Enabling may be useful if you request your translations from a server and
   * have a quote or rate limit on the number of requests.
   */
  cacheInDevelopment?: boolean;
  /**
   * If you want to use a cookie to store the user preferred language, you can
   * pass the Cookie object here.
   */
  cookie?: Cookie;
  /**
   * If you want to use a session to store the user preferred language, you can
   * pass the SessionStorage object here.
   */
  sessionStorage?: SessionStorage;
  /**
   * If defined a sessionStorage and want to change the default key used to
   * store the user preferred language, you can pass the key here.
   * @default "lng"
   */
  sessionKey?: string;
}

export interface CacheKey {
  namespace: string;
  locale: string;
}

export interface Cache {
  get(key: CacheKey): Promise<Language | null>;
  set(key: CacheKey, value: Language): Promise<void>;
  has(key: CacheKey): Promise<boolean>;
}

export class RemixI18Next {
  private cache: Cache;
  constructor(private backend: Backend, private options: RemixI18NextOptions) {
    this.cache = options.cache ?? new InMemoryCache();
  }

  async getTranslations(
    request: Request,
    namespaces: string | string[]
  ): Promise<Record<string, Language>> {
    let locale = await this.getLocale(request);

    if (Array.isArray(namespaces)) {
      let messages = await Promise.all(
        namespaces.map((namespace) =>
          this.getTranslation({ namespace, locale })
        )
      );
      return Object.fromEntries(
        messages.map((message, index) => [namespaces[index], message])
      );
    }

    return {
      [namespaces]: await this.getTranslation({
        namespace: namespaces,
        locale,
      }),
    };
  }

  /**
   * Get the user preferred language from the HTTP Request. This method will
   * try to get the language from the Accept-Language header, then the Cookie
   * and finally the search param `?lng`.
   * If none of the methods are able to get the language, it will return the
   * fallback language.
   */
  public async getLocale(request: Request): Promise<string> {
    let locale = this.getLocaleFromSearchParams(request);
    if (locale) return locale;

    locale = await this.getLocaleFromCookie(request);
    if (locale) return locale;

    locale = await this.getLocaleFromSessionStorage(request);
    if (locale) return locale;

    locale = this.getLocaleFromHeader(request);
    if (locale) return locale;

    return this.options.fallbackLng;
  }

  /**
   * Get the user preferred language from the search param `?lng`
   */
  private getLocaleFromSearchParams(request: Request) {
    let url = new URL(request.url);
    if (!url.searchParams.has("lng")) return;
    return this.getFromSupported(url.searchParams.get("lng"));
  }

  /**
   * Get the user preferred language from a Cookie.
   */
  private async getLocaleFromCookie(request: Request) {
    if (!this.options.cookie) return;

    let cookie = this.options.cookie;

    let lng = (await cookie.parse(request.headers.get("Cookie"))) ?? "";
    if (!lng) return;

    let locale = this.getFromSupported(lng);
    if (locale !== this.options.fallbackLng) return locale;
  }

  /**
   * Get the user preferred language from the Session.
   */
  private async getLocaleFromSessionStorage(request: Request) {
    if (!this.options.sessionStorage) return;

    let session = await this.options.sessionStorage.getSession(
      request.headers.get("Cookie")
    );

    let lng = session.get(this.options.sessionKey ?? "lng");

    if (!lng) return;

    let locale = this.getFromSupported(lng);
    if (locale !== this.options.fallbackLng) return locale;
  }

  /**
   * Get the user preferred language from the Accept-Language header.
   */
  private getLocaleFromHeader(request: Request) {
    let header = request.headers.get("Accept-Language");
    if (!header) return;
    let locale = this.getFromSupported(header);
    if (!locale) return;
    return locale;
  }

  private getFromSupported(language: string | null) {
    return (
      pick(
        this.options.supportedLanguages,
        language ?? this.options.fallbackLng,
        { loose: true }
      ) ?? this.options.fallbackLng
    );
  }

  private async getTranslation(key: CacheKey): Promise<Language> {
    if (this.cacheEnabled) {
      let cached = await this.cache.get(key);
      if (cached) return cached;
    }

    let translations = await this.backend.getTranslations(
      key.namespace,
      key.locale
    );

    if (this.cacheEnabled) {
      await this.cache.set(key, translations);
    }

    return translations;
  }

  private get cacheEnabled() {
    return (
      this.options.cacheInDevelopment && process.env.NODE_ENV === "development"
    );
  }
}

class InMemoryCache implements Cache {
  private cache = new Map<string, Language>();

  async set(key: CacheKey, value: Language): Promise<void> {
    this.cache.set(this.serialize(key), value);
  }

  async get(key: CacheKey): Promise<Language | null> {
    return this.cache.get(this.serialize(key)) ?? null;
  }

  async has(key: CacheKey): Promise<boolean> {
    return this.cache.has(this.serialize(key));
  }

  private serialize(cacheKey: CacheKey) {
    return `${cacheKey.locale}/${cacheKey.namespace}`;
  }
}

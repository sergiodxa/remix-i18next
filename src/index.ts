import { pick } from "accept-language-parser";
import type { Cookie } from "remix";
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
  cookie?: Cookie;
  cookieKey?: string;
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

  public async getLocale(request: Request): Promise<string> {
    let locale = this.getLocaleFromSearchParams(request);

    if (this.options.cookie && this.options.cookieKey) {
      let cookie = this.options.cookie;
      let { [this.options.cookieKey]: lng } =
        (await cookie.parse(request.headers.get("Cookie"))) ?? {};
      if (lng) {
        let locale = this.getFromSupported(lng);
        if (locale !== this.options.fallbackLng) return locale;
      }
    }

    if (request.headers.has("accept-language")) {
      let locale = this.getFromSupported(
        request.headers.get("accept-language")
      );
      if (locale !== this.options.fallbackLng) return locale;
    }

    return this.options.fallbackLng;
  }

  private getLocaleFromSearchParams(request: Request) {
    let url = new URL(request.url);
    if (!url.searchParams.has("lng")) return;
    return this.getFromSupported(url.searchParams.get("lng"));
  }

  private async getLocaleFromCookie(request: Request) {
    if (!this.options.cookie && !this.options.cookieKey) return;
    if (this.options.cookie && !this.options.cookieKey) {
      throw new Error("The cookieKey is required if a cookie is provided");
    }

    let cookie = this.options.cookie;

    let { [this.options.cookieKey]: lng } =
      (await cookie.parse(request.headers.get("Cookie"))) ?? {};

    if (!lng) return;

    let locale = this.getFromSupported(lng);
    if (locale !== this.options.fallbackLng) return locale;
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

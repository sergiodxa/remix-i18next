import { pick } from "accept-language-parser";
import type { Backend, Language } from "./backend";

interface RemixI18NextOptions {
  supportedLanguages: string[];
  fallbackLng: string;
  cache?: Cache;
  cacheInDevelopment?: boolean;
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
    let locale = this.getLocale(request);

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

  public getLocale(request: Request): string {
    let url = new URL(request.url);
    if (url.searchParams.has("lng")) {
      return this.getFromSupported(url.searchParams.get("lng"));
    }

    // let cookie = Object.fromEntries(
    //   request.headers
    //     .get("Cookie")
    //     ?.split(";")
    //     .map((cookie) => cookie.split("=")) ?? []
    // ) as { i18next?: string };

    // if (cookie.i18next) {
    //   return this.getFromSupported(cookie.i18next);
    // }

    if (request.headers.has("accept-language")) {
      return this.getFromSupported(request.headers.get("accept-language"));
    }

    return this.options.fallbackLng;
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

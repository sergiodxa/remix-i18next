import type {
  Cookie,
  EntryContext,
  SessionStorage,
} from "@remix-run/server-runtime";
import { pick } from "accept-language-parser";
import {
  Module,
  BackendModule,
  createInstance,
  InitOptions,
  NewableModule,
  TFunction,
  Namespace,
} from "i18next";
import { getClientLocales } from "./lib/get-client-locales.js";

const DEFAULT_NS: Namespace = "translation";

export interface LanguageDetectorOption {
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
  fallbackLanguage: string;
  /**
   * If you want to use a cookie to store the user preferred language, you can
   * pass the Cookie object here.
   */
  cookie?: Cookie;
  /**
   * If you want to use a session to store the user preferred language, you can
   * pass the SessionStorage object here.
   * When this is not defined, getting the locale will ignore the session.
   */
  sessionStorage?: SessionStorage;
  /**
   * If defined a sessionStorage and want to change the default key used to
   * store the user preferred language, you can pass the key here.
   * @default "lng"
   */
  sessionKey?: string;
  /**
   * If you want to use search parameters for language detection and want to
   * change the default key used to for the parameter name,
   * you can pass the key here.
   * @default "lng"
   */
  searchParamKey?: string;
  /**
   * The order the library will use to detect the user preferred language.
   * By default the order is
   * - searchParams
   * - cookie
   * - session
   * - header
   * And finally the fallback language.
   */
  order?: Array<"searchParams" | "cookie" | "session" | "header">;
}

export interface RemixI18NextOption {
  /**
   * The i18next options used to initialize the internal i18next instance.
   */
  i18next?: Omit<InitOptions, "react" | "detection"> | null;
  /**
   * @deprecated Use `plugins` instead.
   * The i18next backend module used to load the translations when creating a
   * new TFunction.
   */
  backend?: NewableModule<BackendModule<unknown>> | BackendModule<unknown>;
  /**
   * The i18next plugins used to extend the internal i18next instance
   * when creating a new TFunction.
   */
  plugins?: NewableModule<Module>[] | Module[];
  detection: LanguageDetectorOption;
}

export class RemixI18Next {
  private detector: LanguageDetector;

  constructor(private options: RemixI18NextOption) {
    this.detector = new LanguageDetector(this.options.detection);
  }

  /**
   * Detect the current locale by following the order defined in the
   * `detection.order` option.
   * By default the order is
   * - searchParams
   * - cookie
   * - session
   * - header
   * And finally the fallback language.
   */
  public async getLocale(request: Request): Promise<string> {
    return this.detector.detect(request);
  }

  /**
   * Get the namespaces required by the routes which are going to be rendered
   * when doing SSR.
   *
   * @param context The EntryContext object received by `handleRequest` in entry.server
   *
   * @example
   * await instance.init({
   *   ns: i18n.getRouteNamespaces(context),
   *   // ...more options
   * });
   */
  public getRouteNamespaces(context: EntryContext): string[] {
    let namespaces = Object.values(context.routeModules)
      .filter(
        (route) =>
          (route.handle as { i18n?: string | string[] })?.i18n !== undefined
      )
      .flatMap((route) => {
        let i18n = (route.handle as { i18n: string | string[] }).i18n;
        if (typeof i18n === "string") return i18n;
        if (!Array.isArray(i18n)) return [];
        if (i18n.every((ns) => typeof ns === "string")) return i18n as string[];
        return [];
      });

    return [...new Set(namespaces)];
  }

  /**
   * Return a TFunction that can be used to translate strings server-side.
   * This function is fixed to a specific namespace.
   *
   * @param requestOrLocale The request object or the locale string already detected
   * @param namespaces The namespaces to use for the T function. (Default: `translation`).
   * @param options The i18next init options
   */
  async getFixedT<N extends Namespace>(
    locale: string,
    namespaces?: N,
    options?: Omit<InitOptions, "react">
  ): Promise<TFunction<N>>;
  async getFixedT<N extends Namespace>(
    request: Request,
    namespaces?: N,
    options?: Omit<InitOptions, "react">
  ): Promise<TFunction<N>>;
  async getFixedT<N extends Namespace>(
    requestOrLocale: Request | string,
    namespaces?: N,
    options: Omit<InitOptions, "react"> = {}
  ) {
    let parsedNamespaces = namespaces ?? DEFAULT_NS;
    // Make sure there's at least one namespace
    if (!namespaces || namespaces.length === 0) {
      parsedNamespaces = (this.options.i18next?.defaultNS ||
        "translation") as N;
    }

    let [instance, locale] = await Promise.all([
      this.createInstance({
        ...this.options.i18next,
        ...options,
        fallbackNS: parsedNamespaces,
        defaultNS:
          typeof parsedNamespaces === "string"
            ? parsedNamespaces
            : parsedNamespaces[0],
      }),
      typeof requestOrLocale === "string"
        ? requestOrLocale
        : this.getLocale(requestOrLocale),
    ]);

    await instance.changeLanguage(locale);
    await instance.loadNamespaces(parsedNamespaces);

    return instance.getFixedT(locale, parsedNamespaces);
  }

  private async createInstance(options: Omit<InitOptions, "react"> = {}) {
    let instance = createInstance();
    let plugins = [
      ...(this.options.backend ? [this.options.backend] : []),
      ...(this.options.plugins || []),
    ];
    for (const plugin of plugins) instance.use(plugin);
    await instance.init(options);
    return instance;
  }
}

class LanguageDetector {
  constructor(private options: LanguageDetectorOption) {
    this.isSessionOnly(options);
    this.isCookieOnly(options);
  }

  private isSessionOnly(options: LanguageDetectorOption) {
    if (
      options.order?.length === 1 &&
      options.order[0] === "session" &&
      !options.sessionStorage
    ) {
      throw new Error(
        "You need a sessionStorage if you want to only get the locale from the session"
      );
    }
  }

  private isCookieOnly(options: LanguageDetectorOption) {
    if (
      options.order?.length === 1 &&
      options.order[0] === "cookie" &&
      !options.cookie
    ) {
      throw new Error(
        "You need a cookie if you want to only get the locale from the cookie"
      );
    }
  }

  public async detect(request: Request): Promise<string> {
    let order = this.options.order ?? [
      "searchParams",
      "cookie",
      "session",
      "header",
    ];

    for (let method of order) {
      let locale: string | null = null;

      if (method === "searchParams") {
        locale = await this.fromSearchParams(request);
      }

      if (method === "cookie") {
        locale = await this.fromCookie(request);
      }

      if (method === "session") {
        locale = await this.fromSessionStorage(request);
      }

      if (method === "header") {
        locale = await this.fromHeader(request);
      }

      if (locale) return locale;
    }

    return this.options.fallbackLanguage;
  }

  private async fromSearchParams(request: Request): Promise<string | null> {
    let url = new URL(request.url);
    if (!url.searchParams.has(this.options.searchParamKey ?? "lng")) {
      return null;
    }
    return this.fromSupported(
      url.searchParams.get(this.options.searchParamKey ?? "lng")
    );
  }

  private async fromCookie(request: Request): Promise<string | null> {
    if (!this.options.cookie) return null;

    let cookie = this.options.cookie;
    let lng = (await cookie.parse(request.headers.get("Cookie"))) ?? "";
    if (!lng) return null;

    return this.fromSupported(lng);
  }

  private async fromSessionStorage(request: Request): Promise<string | null> {
    if (!this.options.sessionStorage) return null;

    let session = await this.options.sessionStorage.getSession(
      request.headers.get("Cookie")
    );

    let lng = session.get(this.options.sessionKey ?? "lng");

    if (!lng) return null;

    return this.fromSupported(lng);
  }

  private async fromHeader(request: Request): Promise<string | null> {
    let locales = getClientLocales(request);
    if (!locales) return null;
    if (Array.isArray(locales)) return this.fromSupported(locales.join(","));
    return this.fromSupported(locales);
  }

  private fromSupported(language: string | null) {
    return (
      pick(
        this.options.supportedLanguages,
        language ?? this.options.fallbackLanguage,
        { loose: false }
      ) ||
      pick(
        this.options.supportedLanguages,
        language ?? this.options.fallbackLanguage,
        { loose: true }
      )
    );
  }
}

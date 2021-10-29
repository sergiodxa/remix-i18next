import { pick } from "accept-language-parser";
import type { Backend, Language } from "./backend";

interface RemixI18NextOptions {
  supportedLanguages: string[];
  fallbackLng: string;
}

export class RemixI18Next {
  constructor(private backend: Backend, private options: RemixI18NextOptions) {}

  async getTranslations(
    request: Request,
    namespaces: string | string[]
  ): Promise<Record<string, Language>> {
    let locale = this.getLocale(request);

    if (Array.isArray(namespaces)) {
      let messages = await Promise.all(
        namespaces.map((namespace) =>
          this.backend.getTranslations(namespace, locale)
        )
      );
      return Object.fromEntries(
        messages.map((message, index) => [namespaces[index], message])
      );
    }

    return {
      [namespaces]: await this.backend.getTranslations(namespaces, locale),
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
}

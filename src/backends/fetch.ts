import { generatePath } from "react-router-dom";
import { Backend } from "../backend";

interface FetchBackendOptions {
  /**
   * A URL object to be used as a base for generating the final URL.
   */
  baseUrl: URL;
  /**
   * A path pattern used to generate the path including the namespace and
   * locale. It should include the `:pathname` and `:locale` tokens somewhere.
   * @example
   * /i18n/:locale/:namespace
   */
  pathPattern: string;
  /**
   * An object with any header to apply to the request, this is useful to apply
   * custom Accept and Authorization headers to the request.
   * If not defined, the Accept header will be set to `application/json`.
   * This could be either a plain object, an entry array or a Headers instance.
   */
  headers?: HeadersInit;
}

export class FetchBackend implements Backend {
  constructor(private options: FetchBackendOptions) {}

  async getTranslations(namespace: string, locale: string) {
    let path = generatePath(this.options.pathPattern, {
      namespace,
      locale,
    });

    let url = new URL(path, this.options.baseUrl);

    let headers = new Headers(this.options.headers);
    if (!headers.has("Accept")) headers.set("Accept", "application/json");

    let response = await fetch(url.toString(), { headers, method: "GET" });
    return await response.json();
  }
}

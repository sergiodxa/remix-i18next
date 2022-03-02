import { Backend } from "../backend";

export class InMemoryBackend implements Backend {
  constructor(
    private readonly data: {
      [locale: string]: {
        [namespace: string]: {
          [key: string]: string;
        };
      };
    }
  ) {}

  async getTranslations(namespace: string, locale: string) {
    return this.data[locale][namespace];
  }
}

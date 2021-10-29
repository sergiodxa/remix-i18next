type Value = string | Language;
type Key = string;
export type Language = { [key: Key]: Value };

export interface Backend<Messages extends Language = Language> {
  getTranslations(namespace: string, locale: string): Promise<Messages>;
}

export * from "./backends";

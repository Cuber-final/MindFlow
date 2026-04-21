export type Locale = 'zh-CN' | 'en-US';

export type TranslationValue = string | TranslationDictionary;

export interface TranslationDictionary {
  [key: string]: TranslationValue;
}

export interface TranslateParams {
  [key: string]: string | number;
}

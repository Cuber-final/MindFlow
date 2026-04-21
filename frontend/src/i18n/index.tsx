import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import enUS from './locales/en-US';
import zhCN from './locales/zh-CN';
import type { Locale, TranslateParams, TranslationDictionary, TranslationValue } from './types';

const STORAGE_KEY = 'mindflow.locale';

const dictionaries: Record<Locale, TranslationDictionary> = {
  'en-US': enUS,
  'zh-CN': zhCN,
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: string, params?: TranslateParams) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function detectBrowserLocale(): Locale {
  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh')) {
    return 'zh-CN';
  }
  return 'en-US';
}

function readInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'en-US';
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === 'zh-CN' || saved === 'en-US') return saved;
  return detectBrowserLocale();
}

function resolveValue(dict: TranslationDictionary, key: string): TranslationValue | undefined {
  return key.split('.').reduce<TranslationValue | undefined>((cursor, part) => {
    if (!cursor || typeof cursor === 'string') return undefined;
    return cursor[part];
  }, dict);
}

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? `{${key}}`));
}

function applyDayjsLocale(locale: Locale) {
  dayjs.locale(locale === 'zh-CN' ? 'zh-cn' : 'en');
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const initial = readInitialLocale();
    applyDayjsLocale(initial);
    return initial;
  });

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, nextLocale);
    }
    applyDayjsLocale(nextLocale);
  };

  const contextValue = useMemo<I18nContextValue>(() => {
    const t = (key: string, params?: TranslateParams): string => {
      const current = resolveValue(dictionaries[locale], key);
      const fallback = resolveValue(dictionaries['en-US'], key);
      const value = typeof current === 'string' ? current : typeof fallback === 'string' ? fallback : key;
      return interpolate(value, params);
    };

    return {
      locale,
      setLocale,
      toggleLocale: () => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN'),
      t,
    };
  }, [locale]);

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}

export type { Locale };

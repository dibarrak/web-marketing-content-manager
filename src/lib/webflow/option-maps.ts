/**
 * Webflow returns Option-type fields as opaque internal IDs (not the option
 * name). These maps translate `id ↔ name` so the UI can show readable values
 * and we could, if needed, send IDs on writes too.
 *
 * IDs are mirrored from the CMS schemas captured during onboarding. If a new
 * option is added in Webflow, append it here.
 */

import type { CollectionKey } from '@lib/config/sites';

type OptionMap = Record<string, Record<string, string>>; // fieldSlug → id → name

const HERO_BANNER_OPTIONS: OptionMap = {
  'pagina-despliegue': {
    af4989c1c1b199dc98c6000c0eea838d: 'Home',
    '07715730ebe4b67384fd387efbf17554': 'Amazon',
    '6ef2c8e925bd91c6fdb181bb347dd8e0': 'Temu',
    '0fee71c62bed91926ae4334df405ff9c': 'Promociones',
    e95e56ff92c94834b798a86e77b56080: 'Prototype',
    bb2869d79b634bfd00004492bc097821: 'Registrate Hoy',
    '77799fb753ea35a517101359b991479c': 'Longtail',
  },
  'variante-boton-creacion-cuenta': {
    '1defc227ac17f951af55f5d2300b59f3': 'primary',
    ffb0f95383123a8abf230fddd07f52a2: 'secondary',
    '65bc66bf1a9b29ba6be7c664896c6011': 'primary - transparent',
    '0d8b434de9e2c9211fb50d7709a259b7': 'secondary - outline',
    '8cac73590e1d3a7f489129e19ebf4d51': 'beat',
    '81cc10890d490e96018cc9f9706fdba2': 'beat - primary transparent',
    a16256a8f42146a40d1009d6a9a5bc22: 'beat - secondary transparent',
  },
  'variante-boton-extra': {
    '87612ef119f1450d77c911b1b47940d8': 'primary',
    '105900d33ad95345ddc2cb2a891a33d6': 'secondary',
    c871766982406508fc24199aa7022650: 'primary - transparent',
    '52abc56705cd1e73b3a1a18e2250539e': 'secondary - outline',
    '0d260ce2a9d2a20fe91695dc9aa7c6e2': 'beat',
    b7f2b55dce111e6ed9a7a4bda8bae038: 'beat - primary transparent',
    '033ef60ef3adb6669c15a422118f46b3': 'beat - secondary transparent',
  },
  'variante-de-gradiente': {
    dce215c430cefb2330883791e78f896e: 'Variante 1 - Naranja',
    '8510a01a0170603a253ba8c2e049e4e7': 'Variante 2 - Azul',
    '68108dc7a297a54d04cb548db90f1ba0': 'Variante 3 - Cian-Cobalto',
    d5bb27252083be58f8ca5f5abf9987ce: 'Variante 4 - Acero-Glacial',
    '5bc1f8740c3abdf8bfc02cdf351f4652': 'Variante 5 - La vida no espera',
  },
};

const MAPS: Partial<Record<CollectionKey, OptionMap>> = {
  heroBanners: HERO_BANNER_OPTIONS,
};

/** Returns the human-readable name for an Option value, or the raw value if unknown. */
export function optionLabel(
  collectionKey: CollectionKey,
  fieldSlug: string,
  value: unknown,
): unknown {
  if (typeof value !== 'string') return value;
  const map = MAPS[collectionKey]?.[fieldSlug];
  return map?.[value] ?? value;
}

/** Reverse lookup: name → id. Used on writes if Webflow requires the ID. */
export function optionId(
  collectionKey: CollectionKey,
  fieldSlug: string,
  name: string,
): string | undefined {
  const map = MAPS[collectionKey]?.[fieldSlug];
  if (!map) return undefined;
  return Object.entries(map).find(([, n]) => n === name)?.[0];
}

/** Apply optionLabel across an item's fieldData (non-mutating). */
export function translateOptionFields<T extends Record<string, unknown>>(
  collectionKey: CollectionKey,
  fieldData: T,
): T {
  const map = MAPS[collectionKey];
  if (!map) return fieldData;
  const out: Record<string, unknown> = { ...fieldData };
  for (const slug of Object.keys(map)) {
    if (slug in out) out[slug] = optionLabel(collectionKey, slug, out[slug]);
  }
  return out as T;
}

/** Reverse: human-readable option names → Webflow IDs (non-mutating). Used before writes. */
export function reverseTranslateOptionFields<T extends Record<string, unknown>>(
  collectionKey: CollectionKey,
  fieldData: T,
): T {
  const map = MAPS[collectionKey];
  if (!map) return fieldData;
  const out: Record<string, unknown> = { ...fieldData };
  for (const [slug, idMap] of Object.entries(map)) {
    if (slug in out && typeof out[slug] === 'string') {
      const id = Object.entries(idMap).find(([, name]) => name === out[slug])?.[0];
      if (id) out[slug] = id;
    }
  }
  return out as T;
}

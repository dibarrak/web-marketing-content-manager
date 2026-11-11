import { describe, expect, it } from 'vitest';
import {
  isValidSiteTarget,
  matchesSiteTarget,
  parseSiteTarget,
  serializeSiteTarget,
  unwrapSingleParagraph,
} from './ad-banners';

describe('parseSiteTarget', () => {
  it('parses one or several destinations in canonical order and casing', () => {
    expect(parseSiteTarget('amazon, HOME')).toEqual(['Home', 'Amazon']);
    expect(parseSiteTarget('Registrate hoy;Longtail')).toEqual(['Registrate hoy', 'Longtail']);
  });

  it('collapses to all when any token is all', () => {
    expect(parseSiteTarget('Home, all')).toEqual(['all']);
    expect(parseSiteTarget('*')).toEqual(['all']);
  });

  it('ignores unknown tokens and empty input', () => {
    expect(parseSiteTarget('Home, Nope')).toEqual(['Home']);
    expect(parseSiteTarget(null)).toEqual([]);
    expect(parseSiteTarget('')).toEqual([]);
  });
});

describe('serializeSiteTarget', () => {
  it('joins in canonical order with ", "', () => {
    expect(serializeSiteTarget(['Amazon', 'Home'])).toBe('Home, Amazon');
  });

  it('returns all when selected, regardless of the rest', () => {
    expect(serializeSiteTarget(['Home', 'all'])).toBe('all');
  });

  it('returns an empty string for no selection', () => {
    expect(serializeSiteTarget([])).toBe('');
  });
});

describe('isValidSiteTarget', () => {
  it('accepts known destinations and all', () => {
    expect(isValidSiteTarget('Home, Amazon')).toBe(true);
    expect(isValidSiteTarget('all')).toBe(true);
  });

  it('rejects empty values and unknown destinations', () => {
    expect(isValidSiteTarget('')).toBe(false);
    expect(isValidSiteTarget(null)).toBe(false);
    expect(isValidSiteTarget('Home, Nope')).toBe(false);
  });
});

describe('matchesSiteTarget', () => {
  it('matches when the site is listed, or the banner targets all', () => {
    expect(matchesSiteTarget('Home, Amazon', 'amazon')).toBe(true);
    expect(matchesSiteTarget('all', 'Longtail')).toBe(true);
  });

  it('does not match other sites, and an empty filter matches everything', () => {
    expect(matchesSiteTarget('Home', 'Amazon')).toBe(false);
    expect(matchesSiteTarget('Home', '')).toBe(true);
  });
});

describe('unwrapSingleParagraph', () => {
  it('drops a single wrapping paragraph', () => {
    expect(unwrapSingleParagraph('<p>Hasta <strong>$200</strong> de dto.</p>')).toBe(
      'Hasta <strong>$200</strong> de dto.',
    );
  });

  it('keeps multi-paragraph and non-wrapped html', () => {
    expect(unwrapSingleParagraph('<p>a</p><p>b</p>')).toBe('<p>a</p><p>b</p>');
    expect(unwrapSingleParagraph('Solo texto')).toBe('Solo texto');
    expect(unwrapSingleParagraph(null)).toBe('');
  });
});

import { describe, expect, it } from 'vitest';
import { DEFAULT_LANDING_PATH, safeLandingPath } from './landing';

describe('safeLandingPath', () => {
  it('giu duong dan noi bo', () => {
    expect(safeLandingPath('/kinh-doanh/don-hang?trang=2')).toBe('/kinh-doanh/don-hang?trang=2');
  });

  it('doi URL cung host ve duong dan', () => {
    expect(safeLandingPath('http://app.test/cskh?tab=mo', 'app.test')).toBe('/cskh?tab=mo');
  });

  it('tu choi URL khac host va duong dan bat dau bang hai dau cheo', () => {
    expect(safeLandingPath('https://example.com/hub', 'app.test')).toBe(DEFAULT_LANDING_PATH);
    expect(safeLandingPath('http://app.test//example.com', 'app.test')).toBe(DEFAULT_LANDING_PATH);
  });

  it.each(['https://example.com', '//example.com', '/\\example.com', '', null, undefined])(
    'tu choi %s',
    (path) => {
      expect(safeLandingPath(path)).toBe(DEFAULT_LANDING_PATH);
    },
  );
});

import { describe, expect, it } from 'vitest';
import { describeCameraError } from '../src/core/camera.js';

describe('describeCameraError', () => {
  it.each([
    ['NotAllowedError', /izni reddedildi/],
    ['NotFoundError', /bulunamadı/],
    ['NotReadableError', /başka bir uygulama/],
    ['InsecureContextError', /localhost/],
  ])('%s için anlaşılır mesaj verir', (name, pattern) => {
    expect(describeCameraError({ name })).toMatch(pattern);
  });

  it('bilinmeyen hatada mesajı korur', () => {
    expect(describeCameraError({ name: 'Weird', message: 'xyz' })).toMatch(/xyz/);
  });
});

import { extractBodyPreview } from '../src/core/extractBodyPreview';

describe('extractBodyPreview', () => {
  it('extracts the body of a free-form text message', () => {
    expect(extractBodyPreview({ type: 'text', text: { body: 'Hello there' } })).toBe('Hello there');
  });

  it('extracts the body text of an interactive (button) message', () => {
    expect(
      extractBodyPreview({ type: 'interactive', interactive: { type: 'button', body: { text: 'Approve this?' } } })
    ).toBe('Approve this?');
  });

  it('labels an HSM template send by name', () => {
    expect(extractBodyPreview({ type: 'template', template: { name: 'order_shipped', language: { code: 'en_US' } } })).toBe(
      '[Template: order_shipped]'
    );
  });

  it('prefers a media caption when present', () => {
    expect(extractBodyPreview({ type: 'image', image: { link: 'https://x/y.png', caption: 'Your receipt' } })).toBe(
      'Your receipt'
    );
  });

  it('falls back to a bracketed type marker when media has no caption', () => {
    expect(extractBodyPreview({ type: 'audio', audio: { link: 'https://x/y.ogg' } })).toBe('[audio]');
  });

  it('returns undefined for an unrecognized payload shape', () => {
    expect(extractBodyPreview({ type: 'something_new' })).toBeUndefined();
  });
});

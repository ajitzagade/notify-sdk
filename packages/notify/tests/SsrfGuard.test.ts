import { isPrivateOrReservedIp, isDeliverableUrl } from '../src/security/SsrfGuard';

describe('isPrivateOrReservedIp', () => {
  it('flags loopback, private, link-local, and CGNAT IPv4 ranges', () => {
    expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('10.0.0.5')).toBe(true);
    expect(isPrivateOrReservedIp('172.16.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('172.31.255.255')).toBe(true);
    expect(isPrivateOrReservedIp('192.168.1.1')).toBe(true);
    expect(isPrivateOrReservedIp('169.254.169.254')).toBe(true); // cloud metadata
    expect(isPrivateOrReservedIp('100.64.0.1')).toBe(true); // CGNAT
    expect(isPrivateOrReservedIp('0.0.0.0')).toBe(true);
  });

  it('flags loopback and unique-local IPv6', () => {
    expect(isPrivateOrReservedIp('::1')).toBe(true);
    expect(isPrivateOrReservedIp('fe80::1')).toBe(true);
    expect(isPrivateOrReservedIp('fd00::1')).toBe(true);
    expect(isPrivateOrReservedIp('::ffff:127.0.0.1')).toBe(true); // IPv4-mapped
  });

  it('allows real public addresses', () => {
    expect(isPrivateOrReservedIp('8.8.8.8')).toBe(false);
    expect(isPrivateOrReservedIp('1.1.1.1')).toBe(false);
    expect(isPrivateOrReservedIp('172.15.0.1')).toBe(false); // just outside the 172.16-31 private range
    expect(isPrivateOrReservedIp('172.32.0.1')).toBe(false); // just outside the other end
  });
});

describe('isDeliverableUrl', () => {
  it('rejects malformed URLs', async () => {
    expect(await isDeliverableUrl('not a url')).toBe(false);
  });

  it('rejects literal private/loopback IPs', async () => {
    expect(await isDeliverableUrl('http://127.0.0.1/hook')).toBe(false);
    expect(await isDeliverableUrl('http://169.254.169.254/latest/meta-data')).toBe(false);
    expect(await isDeliverableUrl('http://10.0.0.5:8080/hook')).toBe(false);
  });

  it('rejects obviously-internal hostnames without a DNS lookup', async () => {
    expect(await isDeliverableUrl('http://localhost/hook')).toBe(false);
    expect(await isDeliverableUrl('http://foo.localhost/hook')).toBe(false);
    expect(await isDeliverableUrl('http://service.internal/hook')).toBe(false);
    expect(await isDeliverableUrl('http://box.local/hook')).toBe(false);
  });

  it('accepts a real public host', async () => {
    expect(await isDeliverableUrl('https://example.com/webhook')).toBe(true);
  });
});

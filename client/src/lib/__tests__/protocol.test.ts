import { describe, expect, it } from 'vitest';

import { dpcPhaseLabel, normalizeWsUrl, parseFrame } from '../protocol';

describe('normalizeWsUrl', () => {
  it('accepts a bare IP address', () => {
    expect(normalizeWsUrl('192.168.1.50')).toBe('ws://192.168.1.50/ws');
  });

  it('accepts a host with a port', () => {
    expect(normalizeWsUrl('nfc-dice.local:81')).toBe('ws://nfc-dice.local:81/ws');
  });

  it('keeps an explicit path', () => {
    expect(normalizeWsUrl('192.168.1.50/socket')).toBe('ws://192.168.1.50/socket');
  });

  it('rewrites http scheme to ws', () => {
    expect(normalizeWsUrl('http://192.168.1.50')).toBe('ws://192.168.1.50/ws');
  });

  it('passes a full ws url through', () => {
    expect(normalizeWsUrl('ws://192.168.1.50/ws')).toBe('ws://192.168.1.50/ws');
  });

  it('returns an empty string for blank input', () => {
    expect(normalizeWsUrl('   ')).toBe('');
  });
});

describe('parseFrame', () => {
  it('parses a known frame', () => {
    const frame = parseFrame('{"t":"scan","ts":1,"powerPct":30,"count":1,"uids":["04:AA"]}');
    expect(frame?.t).toBe('scan');
  });

  it('rejects malformed json', () => {
    expect(parseFrame('{not json')).toBeNull();
  });

  it('rejects unknown frame types', () => {
    expect(parseFrame('{"t":"whatever"}')).toBeNull();
  });

  it('rejects non-objects', () => {
    expect(parseFrame('42')).toBeNull();
    expect(parseFrame('null')).toBeNull();
  });
});

describe('dpcPhaseLabel', () => {
  it('translates every phase', () => {
    expect(dpcPhaseLabel('coarse')).toBe('Hrubé ladenie');
    expect(dpcPhaseLabel('done')).toBe('Doladené');
    expect(dpcPhaseLabel('idle')).toBe('Nečinné');
  });
});

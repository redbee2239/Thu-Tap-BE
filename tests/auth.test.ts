import assert from 'node:assert/strict';
import test from 'node:test';
import { hashPassword, issueTokens, verifyAccessToken, verifyPassword, verifyRefreshToken } from '../src/auth.js';

const secrets = {
  jwtSecret: 'test-access-secret-must-be-at-least-thirty-two-characters',
  jwtRefreshSecret: 'test-refresh-secret-must-be-at-least-thirty-two-characters'
};

test('mật khẩu được hash và verify chính xác', async () => {
  const hash = await hashPassword('correct-horse-battery');
  assert.notEqual(hash, 'correct-horse-battery');
  assert.match(hash, /^\$2[aby]\$/);
  assert.equal(await verifyPassword('correct-horse-battery', hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
});

test('access token và refresh token không dùng lẫn nhau', () => {
  const tokens = issueTokens('user-123', secrets);
  assert.equal(verifyAccessToken(tokens.accessToken, secrets).sub, 'user-123');
  assert.equal(verifyRefreshToken(tokens.refreshToken, secrets).sub, 'user-123');
  assert.throws(() => verifyAccessToken(tokens.refreshToken, secrets));
});

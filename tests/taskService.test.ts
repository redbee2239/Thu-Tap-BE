import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateTaskPriorityScore } from '../src/services.js';

test('điểm ưu tiên tăng khi hạn gần', () => {
  const normal = calculateTaskPriorityScore({ priority: 3, dueDate: null });
  const urgent = calculateTaskPriorityScore({ priority: 3, dueDate: new Date() });
  assert.equal(normal, 30);
  assert.ok(urgent > normal);
});

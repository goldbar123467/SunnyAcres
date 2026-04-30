import { defineConfig } from 'vitest/config';

/**
 * Phase 1 has no client tests (browser-only paths are out of scope for Vitest
 * here; manual exit-test gates §1–7 require a real browser). Phase 4 will
 * bring jsdom back when we test order-book UI logic.
 */
export default defineConfig({
  test: {
    name: 'client',
    environment: 'node',
    include: ['test/**/*.test.ts'],
    passWithNoTests: true,
  },
});

/**
 * Unit tests for list pagination and size-capping.
 *
 * @see https://docs.unraid.net/API/
 */

import { describe, it, expect } from 'vitest';
import { paginateList, validatePagination } from '../src/pagination.js';
import { CHARACTER_LIMIT } from '../src/constants.js';

const ITEMS = Array.from({ length: 10 }, (_, i) => ({ n: i }));

describe('paginateList', () => {
  it('returns all items with metadata when unbounded', () => {
    const result = paginateList(ITEMS);
    expect(result.items).toEqual(ITEMS);
    expect(result.total).toBe(10);
    expect(result.returned).toBe(10);
    expect(result.limit).toBeNull();
    expect(result.offset).toBe(0);
    expect(result.truncated).toBe(false);
  });

  it('applies offset and limit as a window', () => {
    const result = paginateList(ITEMS, { offset: 2, limit: 3 });
    expect(result.items).toEqual([{ n: 2 }, { n: 3 }, { n: 4 }]);
    expect(result.total).toBe(10);
    expect(result.returned).toBe(3);
    expect(result.limit).toBe(3);
    expect(result.offset).toBe(2);
  });

  it('returns an empty window when offset is beyond the end', () => {
    const result = paginateList(ITEMS, { offset: 50 });
    expect(result.items).toEqual([]);
    expect(result.returned).toBe(0);
    expect(result.total).toBe(10);
  });

  it('clamps a limit larger than the remaining items', () => {
    const result = paginateList(ITEMS, { offset: 8, limit: 100 });
    expect(result.returned).toBe(2);
  });

  it('handles an empty collection', () => {
    const result = paginateList([], { limit: 5 });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.truncated).toBe(false);
  });

  it('trims trailing items to stay within the character budget', () => {
    const big = Array.from({ length: 100 }, (_, i) => ({ id: i, blob: 'x'.repeat(50) }));
    const charLimit = 500;
    const result = paginateList(big, {}, charLimit);
    expect(result.truncated).toBe(true);
    expect(result.returned).toBeLessThan(100);
    expect(JSON.stringify(result.items).length).toBeLessThanOrEqual(charLimit);
  });

  it('does not flag truncation when the window fits the budget', () => {
    const result = paginateList(ITEMS, {}, CHARACTER_LIMIT);
    expect(result.truncated).toBe(false);
  });
});

describe('validatePagination', () => {
  it('accepts omitted params', () => {
    expect(validatePagination()).toBeNull();
    expect(validatePagination({})).toBeNull();
  });

  it('accepts a valid limit and offset', () => {
    expect(validatePagination({ limit: 10, offset: 0 })).toBeNull();
  });

  it.each([
    ['zero limit', { limit: 0 }],
    ['negative limit', { limit: -1 }],
    ['non-integer limit', { limit: 1.5 }],
    ['negative offset', { offset: -1 }],
    ['non-integer offset', { offset: 2.5 }],
  ])('rejects %s', (_label, params) => {
    const error = validatePagination(params);
    expect(error).not.toBeNull();
    expect(error?.code).toBe('VALIDATION_ERROR');
  });

  it('accepts offset of zero', () => {
    expect(validatePagination({ offset: 0 })).toBeNull();
  });
});

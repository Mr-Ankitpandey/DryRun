/** Real-language listings for binary search, line-mapped to the pseudocode in
 *  index.ts. Display only; src/algorithms/_code runs them against `reference`. */

import { listing } from '@/algorithms/_code/listing';
import type { CodeListing, RealLanguage } from '@/algorithms/types';

const CLASSIC = 7;
const LOWER = 6;

export const code: Record<string, Partial<Record<RealLanguage, CodeListing>>> = {
  classic: {
    js: listing(CLASSIC, [
      ['function binarySearch(a, x) {'],
      ['  let lo = 0, hi = a.length - 1;', 1],
      ['  while (lo <= hi) {', 2],
      ['    const mid = lo + Math.floor((hi - lo) / 2);', 3],
      ['    if (a[mid] === x) return mid;', 4],
      ['    else if (a[mid] < x) lo = mid + 1;', 5],
      ['    else hi = mid - 1;', 6],
      ['  }'],
      ['  return -1;', 7],
      ['}'],
    ]),
    python: listing(CLASSIC, [
      ['def binary_search(a, x):'],
      ['    lo, hi = 0, len(a) - 1', 1],
      ['    while lo <= hi:', 2],
      ['        mid = lo + (hi - lo) // 2', 3],
      ['        if a[mid] == x:', 4],
      ['            return mid', 4],
      ['        elif a[mid] < x:', 5],
      ['            lo = mid + 1', 5],
      ['        else:', 6],
      ['            hi = mid - 1', 6],
      ['    return -1', 7],
    ]),
    cpp: listing(CLASSIC, [
      ['int binarySearch(const vector<int>& a, int x) {'],
      ['    int lo = 0, hi = (int)a.size() - 1;', 1],
      ['    while (lo <= hi) {', 2],
      ['        int mid = lo + (hi - lo) / 2;', 3],
      ['        if (a[mid] == x) return mid;', 4],
      ['        else if (a[mid] < x) lo = mid + 1;', 5],
      ['        else hi = mid - 1;', 6],
      ['    }'],
      ['    return -1;', 7],
      ['}'],
    ]),
    java: listing(CLASSIC, [
      ['static int binarySearch(int[] a, int x) {'],
      ['    int lo = 0, hi = a.length - 1;', 1],
      ['    while (lo <= hi) {', 2],
      ['        int mid = lo + (hi - lo) / 2;', 3],
      ['        if (a[mid] == x) return mid;', 4],
      ['        else if (a[mid] < x) lo = mid + 1;', 5],
      ['        else hi = mid - 1;', 6],
      ['    }'],
      ['    return -1;', 7],
      ['}'],
    ]),
  },
  lower: {
    js: listing(LOWER, [
      ['function lowerBound(a, x) {'],
      ['  let lo = 0, hi = a.length;', 1],
      ['  while (lo < hi) {', 2],
      ['    const mid = lo + Math.floor((hi - lo) / 2);', 3],
      ['    if (a[mid] < x) lo = mid + 1;', 4],
      ['    else hi = mid;', 5],
      ['  }'],
      ['  return lo;', 6],
      ['}'],
    ]),
    python: listing(LOWER, [
      ['def lower_bound(a, x):'],
      ['    lo, hi = 0, len(a)', 1],
      ['    while lo < hi:', 2],
      ['        mid = lo + (hi - lo) // 2', 3],
      ['        if a[mid] < x:', 4],
      ['            lo = mid + 1', 4],
      ['        else:', 5],
      ['            hi = mid', 5],
      ['    return lo', 6],
    ]),
    cpp: listing(LOWER, [
      ['int lowerBound(const vector<int>& a, int x) {'],
      ['    int lo = 0, hi = (int)a.size();', 1],
      ['    while (lo < hi) {', 2],
      ['        int mid = lo + (hi - lo) / 2;', 3],
      ['        if (a[mid] < x) lo = mid + 1;', 4],
      ['        else hi = mid;', 5],
      ['    }'],
      ['    return lo;', 6],
      ['}'],
    ]),
    java: listing(LOWER, [
      ['static int lowerBound(int[] a, int x) {'],
      ['    int lo = 0, hi = a.length;', 1],
      ['    while (lo < hi) {', 2],
      ['        int mid = lo + (hi - lo) / 2;', 3],
      ['        if (a[mid] < x) lo = mid + 1;', 4],
      ['        else hi = mid;', 5],
      ['    }'],
      ['    return lo;', 6],
      ['}'],
    ]),
  },
};

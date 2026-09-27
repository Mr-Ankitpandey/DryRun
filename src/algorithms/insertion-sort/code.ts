/** Real-language listings for insertion sort, line-mapped to the pseudocode in
 *  index.ts. Display only; src/algorithms/_code runs them against `reference`. */

import { listing } from '@/algorithms/_code/listing';
import type { CodeListing, RealLanguage } from '@/algorithms/types';

const N = 6;

export const code: Record<string, Partial<Record<RealLanguage, CodeListing>>> = {
  classic: {
    js: listing(N, [
      ['function insertionSort(a) {'],
      ['  for (let i = 1; i < a.length; i++) {', 1],
      ['    const key = a[i];', 2],
      ['    let j = i - 1;', 2],
      ['    while (j >= 0 && a[j] > key) {', 3],
      ['      a[j + 1] = a[j];', 4],
      ['      j--;', 5],
      ['    }'],
      ['    a[j + 1] = key;', 6],
      ['  }'],
      ['}'],
    ]),
    python: listing(N, [
      ['def insertion_sort(a):'],
      ['    for i in range(1, len(a)):', 1],
      ['        key = a[i]', 2],
      ['        j = i - 1', 2],
      ['        while j >= 0 and a[j] > key:', 3],
      ['            a[j + 1] = a[j]', 4],
      ['            j -= 1', 5],
      ['        a[j + 1] = key', 6],
    ]),
    cpp: listing(N, [
      ['void insertionSort(vector<int>& a) {'],
      ['    for (int i = 1; i < (int)a.size(); i++) {', 1],
      ['        int key = a[i];', 2],
      ['        int j = i - 1;', 2],
      ['        while (j >= 0 && a[j] > key) {', 3],
      ['            a[j + 1] = a[j];', 4],
      ['            j--;', 5],
      ['        }'],
      ['        a[j + 1] = key;', 6],
      ['    }'],
      ['}'],
    ]),
    java: listing(N, [
      ['static void insertionSort(int[] a) {'],
      ['    for (int i = 1; i < a.length; i++) {', 1],
      ['        int key = a[i];', 2],
      ['        int j = i - 1;', 2],
      ['        while (j >= 0 && a[j] > key) {', 3],
      ['            a[j + 1] = a[j];', 4],
      ['            j--;', 5],
      ['        }'],
      ['        a[j + 1] = key;', 6],
      ['    }'],
      ['}'],
    ]),
  },
};

import type { AlgorithmModule } from '@/algorithms/types';
import { code } from './code';
import type { BinarySearchInput } from './core';
import { binarySearchCore } from './core';

export * from './core';

/** The full module, with JS / Python / C++ / Java listings. */
export const binarySearch: AlgorithmModule<BinarySearchInput> = { ...binarySearchCore, code };

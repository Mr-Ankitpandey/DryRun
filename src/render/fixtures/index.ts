import { graphFixture } from './graph';
import { gridFixture } from './grid';
import { recursionFixture } from './recursion';
import { treeFixture } from './tree';
import type { Fixture } from './types';

export type { Fixture } from './types';

export const fixtures: Record<string, Fixture> = {
  [treeFixture.id]: treeFixture,
  [graphFixture.id]: graphFixture,
  [gridFixture.id]: gridFixture,
  [recursionFixture.id]: recursionFixture,
};

export const fixtureIds = Object.keys(fixtures);

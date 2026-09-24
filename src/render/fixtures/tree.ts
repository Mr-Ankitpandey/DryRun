/** BST fixture: build a tree, then delete a node with one child (detach →
 *  relink child → remove) and a node with two children (structural: the
 *  successor takes its place; both former children relink under it). */

import type { Step } from '@/engine/events';
import { ids } from '@/engine/ids';
import { emptyState } from '@/engine/state';
import type { Fixture } from './types';

const n = ids.node;

const steps: Step[] = [
  { line: 1, events: [{ t: 'node.add', id: n(8), key: 8, parent: null, side: null }], note: 'Insert 8: the tree is empty, so 8 becomes the root.', phase: 'insert' },
  { line: 2, events: [{ t: 'compare', a: { id: n(8) }, b: { var: 'x' }, result: '<' }, { t: 'var', name: 'x', value: 3 }], note: '3 < 8: go left.', phase: 'insert' },
  { line: 3, events: [{ t: 'node.add', id: n(3), key: 3, parent: n(8), side: 'L' }], note: 'Left of 8 is empty: 3 goes there.', phase: 'insert' },
  { line: 3, events: [{ t: 'var', name: 'x', value: 10 }, { t: 'node.add', id: n(10), key: 10, parent: n(8), side: 'R' }], note: '10 > 8: right of 8 is empty, 10 goes there.', phase: 'insert' },
  { line: 3, events: [{ t: 'var', name: 'x', value: 1 }, { t: 'node.add', id: n(1), key: 1, parent: n(3), side: 'L' }], note: '1 < 8, 1 < 3: left of 3.', phase: 'insert' },
  { line: 3, events: [{ t: 'var', name: 'x', value: 6 }, { t: 'node.add', id: n(6), key: 6, parent: n(3), side: 'R' }], note: '6 < 8, 6 > 3: right of 3.', phase: 'insert' },
  { line: 3, events: [{ t: 'var', name: 'x', value: 14 }, { t: 'node.add', id: n(14), key: 14, parent: n(10), side: 'R' }], note: '14 > 8, 14 > 10: right of 10.', phase: 'insert' },
  { line: 3, events: [{ t: 'var', name: 'x', value: 4 }, { t: 'node.add', id: n(4), key: 4, parent: n(6), side: 'L' }], note: '4 < 8, 4 > 3, 4 < 6: left of 6.', phase: 'insert' },
  { line: 3, events: [{ t: 'var', name: 'x', value: 7 }, { t: 'node.add', id: n(7), key: 7, parent: n(6), side: 'R' }], note: '7 < 8, 7 > 3, 7 > 6: right of 6.', phase: 'insert' },
  { line: 3, events: [{ t: 'var', name: 'x', value: 13 }, { t: 'node.add', id: n(13), key: 13, parent: n(14), side: 'L' }], note: '13 > 8, 13 > 10, 13 < 14: left of 14.', phase: 'insert' },
  // ---- delete 14 (one child: 13)
  { line: 5, events: [{ t: 'var', name: 'x', value: 14 }, { t: 'read', ref: { id: n(14) } }, { t: 'mark', ref: { id: n(14) }, as: 'active' }], note: 'Delete 14: it has exactly one child, 13.', phase: 'delete' },
  { line: 6, events: [{ t: 'node.detach', id: n(14) }], note: '14 leaves its parent 10; its subtree (13) floats with it.', phase: 'delete' },
  { line: 7, events: [{ t: 'node.relink', id: n(13), parent: n(10), side: 'R' }], note: '13 takes the place of 14 under 10.', phase: 'delete' },
  { line: 8, events: [{ t: 'node.remove', id: n(14) }], note: '14 has no children left and is removed.', phase: 'delete' },
  // ---- delete 3 (two children: 1 and 6); successor is 4
  { line: 5, events: [{ t: 'var', name: 'x', value: 3 }, { t: 'read', ref: { id: n(3) } }, { t: 'mark', ref: { id: n(3) }, as: 'active' }], note: 'Delete 3: it has two children, so find its successor.', phase: 'delete' },
  { line: 9, events: [{ t: 'read', ref: { id: n(6) } }, { t: 'read', ref: { id: n(4) } }, { t: 'mark', ref: { id: n(4) }, as: 'key' }], note: 'Successor = leftmost node of the right subtree: 6 → 4.', phase: 'delete' },
  { line: 10, events: [{ t: 'node.detach', id: n(3) }], note: '3 leaves its parent 8; its subtree floats.', phase: 'delete' },
  { line: 11, events: [{ t: 'node.relink', id: n(4), parent: n(8), side: 'L' }], note: '4 moves up to take the place of 3.', phase: 'delete' },
  { line: 12, events: [{ t: 'node.relink', id: n(1), parent: n(4), side: 'L' }], note: 'The left child of 3 becomes the left child of 4.', phase: 'delete' },
  { line: 12, events: [{ t: 'node.relink', id: n(6), parent: n(4), side: 'R' }], note: 'The right subtree of 3 becomes the right subtree of 4.', phase: 'delete' },
  { line: 8, events: [{ t: 'node.remove', id: n(3) }, { t: 'mark', ref: { id: n(4) }, as: 'done' }], note: '3 has no children left and is removed.', phase: 'delete' },
];

export const treeFixture: Fixture = {
  id: 'tree',
  title: 'BST insert and delete',
  pseudocode: [
    'insert(x): if root is null: root = x',
    '  while true: if x < node.key: go left',
    '    else go right; attach at the empty side',
    '',
    'delete(x): find node; count its children',
    '  one child: detach node',
    '    relink child to node.parent',
    '    remove node',
    '  two children: succ = min(node.right)',
    '    detach node',
    '    relink succ to node.parent',
    '    relink node.left, node.right under succ',
  ],
  initial: emptyState(),
  steps,
};

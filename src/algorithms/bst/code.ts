/** Real-language listings for BST insert / search / delete, line-mapped to the
 *  pseudocode in index.ts (insert is lines 1–5 of every variant). Keys are
 *  distinct, so insert ignores a key that is already there (the generator and
 *  `reference` do the same). `delete` is a keyword in JS and C++, hence
 *  deleteNode. Display only; src/algorithms/_code runs them against `reference`. */

import type { Row } from '@/algorithms/_code/listing';
import { listing } from '@/algorithms/_code/listing';
import type { CodeListing, RealLanguage } from '@/algorithms/types';

type Lang = RealLanguage;

const NODE: Record<Lang, Row[]> = {
  js: [['class Node {'], ['  constructor(key) {'], ['    this.key = key;'], ['    this.left = null;'], ['    this.right = null;'], ['  }'], ['}']],
  python: [['class Node:'], ['    def __init__(self, key):'], ['        self.key = key'], ['        self.left = None'], ['        self.right = None']],
  cpp: [['struct Node {'], ['    int key;'], ['    Node* left = nullptr;'], ['    Node* right = nullptr;'], ['    Node(int k) : key(k) {}'], ['};']],
  java: [['static class Node {'], ['    int key;'], ['    Node left, right;'], ['    Node(int key) { this.key = key; }'], ['}']],
};

const INSERT: Record<Lang, Row[]> = {
  js: [
    ['function insert(node, x) {', 1],
    ['  if (node === null) return new Node(x);', 2],
    ['  if (x < node.key) node.left = insert(node.left, x);', 3],
    ['  else if (x > node.key) node.right = insert(node.right, x);', 4],
    ['  return node;', 5],
    ['}'],
  ],
  python: [
    ['def insert(node, x):', 1],
    ['    if node is None:', 2],
    ['        return Node(x)', 2],
    ['    if x < node.key:', 3],
    ['        node.left = insert(node.left, x)', 3],
    ['    elif x > node.key:', 4],
    ['        node.right = insert(node.right, x)', 4],
    ['    return node', 5],
  ],
  cpp: [
    ['Node* insert(Node* node, int x) {', 1],
    ['    if (!node) return new Node(x);', 2],
    ['    if (x < node->key) node->left = insert(node->left, x);', 3],
    ['    else if (x > node->key) node->right = insert(node->right, x);', 4],
    ['    return node;', 5],
    ['}'],
  ],
  java: [
    ['static Node insert(Node node, int x) {', 1],
    ['    if (node == null) return new Node(x);', 2],
    ['    if (x < node.key) node.left = insert(node.left, x);', 3],
    ['    else if (x > node.key) node.right = insert(node.right, x);', 4],
    ['    return node;', 5],
    ['}'],
  ],
};

const DELETE: Record<Lang, Row[]> = {
  js: [
    ['function deleteNode(node, x) {', 6],
    ['  if (node === null) return null;', 7],
    ['  if (x < node.key) node.left = deleteNode(node.left, x);', 8],
    ['  else if (x > node.key) node.right = deleteNode(node.right, x);', 9],
    ['  else if (node.left === null) return node.right;', 10],
    ['  else if (node.right === null) return node.left;', 11],
    ['  else {', 12],
    ['    let s = node.right;', 12],
    ['    while (s.left !== null) s = s.left;', 12],
    ['    node.key = s.key;', 12],
    ['    node.right = deleteNode(node.right, s.key);', 13],
    ['  }'],
    ['  return node;', 14],
    ['}'],
  ],
  python: [
    ['def delete_node(node, x):', 6],
    ['    if node is None:', 7],
    ['        return None', 7],
    ['    if x < node.key:', 8],
    ['        node.left = delete_node(node.left, x)', 8],
    ['    elif x > node.key:', 9],
    ['        node.right = delete_node(node.right, x)', 9],
    ['    elif node.left is None:', 10],
    ['        return node.right', 10],
    ['    elif node.right is None:', 11],
    ['        return node.left', 11],
    ['    else:', 12],
    ['        s = node.right', 12],
    ['        while s.left is not None:', 12],
    ['            s = s.left', 12],
    ['        node.key = s.key', 12],
    ['        node.right = delete_node(node.right, s.key)', 13],
    ['    return node', 14],
  ],
  cpp: [
    ['Node* deleteNode(Node* node, int x) {', 6],
    ['    if (!node) return nullptr;', 7],
    ['    if (x < node->key) node->left = deleteNode(node->left, x);', 8],
    ['    else if (x > node->key) node->right = deleteNode(node->right, x);', 9],
    ['    else if (!node->left) { Node* r = node->right; delete node; return r; }', 10],
    ['    else if (!node->right) { Node* l = node->left; delete node; return l; }', 11],
    ['    else {', 12],
    ['        Node* s = node->right;', 12],
    ['        while (s->left) s = s->left;', 12],
    ['        node->key = s->key;', 12],
    ['        node->right = deleteNode(node->right, s->key);', 13],
    ['    }'],
    ['    return node;', 14],
    ['}'],
  ],
  java: [
    ['static Node deleteNode(Node node, int x) {', 6],
    ['    if (node == null) return null;', 7],
    ['    if (x < node.key) node.left = deleteNode(node.left, x);', 8],
    ['    else if (x > node.key) node.right = deleteNode(node.right, x);', 9],
    ['    else if (node.left == null) return node.right;', 10],
    ['    else if (node.right == null) return node.left;', 11],
    ['    else {', 12],
    ['        Node s = node.right;', 12],
    ['        while (s.left != null) s = s.left;', 12],
    ['        node.key = s.key;', 12],
    ['        node.right = deleteNode(node.right, s.key);', 13],
    ['    }'],
    ['    return node;', 14],
    ['}'],
  ],
};

const SEARCH: Record<Lang, Row[]> = {
  js: [
    ['function search(node, x) {', 6],
    ['  if (node === null) return null;', 7],
    ['  if (x === node.key) return node;', 8],
    ['  if (x < node.key) return search(node.left, x);', 9],
    ['  return search(node.right, x);', 10],
    ['}'],
  ],
  python: [
    ['def search(node, x):', 6],
    ['    if node is None:', 7],
    ['        return None', 7],
    ['    if x == node.key:', 8],
    ['        return node', 8],
    ['    if x < node.key:', 9],
    ['        return search(node.left, x)', 9],
    ['    return search(node.right, x)', 10],
  ],
  cpp: [
    ['Node* search(Node* node, int x) {', 6],
    ['    if (!node) return nullptr;', 7],
    ['    if (x == node->key) return node;', 8],
    ['    if (x < node->key) return search(node->left, x);', 9],
    ['    return search(node->right, x);', 10],
    ['}'],
  ],
  java: [
    ['static Node search(Node node, int x) {', 6],
    ['    if (node == null) return null;', 7],
    ['    if (x == node.key) return node;', 8],
    ['    if (x < node.key) return search(node.left, x);', 9],
    ['    return search(node.right, x);', 10],
    ['}'],
  ],
};

const LANGS: Lang[] = ['js', 'python', 'cpp', 'java'];

function variant(pseudoLines: number, op: Record<Lang, Row[]> | null): Partial<Record<Lang, CodeListing>> {
  const out: Partial<Record<Lang, CodeListing>> = {};
  for (const lang of LANGS) {
    const rows: Row[] = [...NODE[lang], [''], ...INSERT[lang]];
    if (op) rows.push([''], ...op[lang]);
    out[lang] = listing(pseudoLines, rows);
  }
  return out;
}

export const code: Record<string, Partial<Record<RealLanguage, CodeListing>>> = {
  insert: variant(5, null),
  delete: variant(14, DELETE),
  search: variant(10, SEARCH),
};

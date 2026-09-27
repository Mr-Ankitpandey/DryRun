/** Real-language listings for BFS, line-mapped to the pseudocode in index.ts.
 *  `adj[u]` is sorted ascending, which is what "in ascending id" relies on.
 *  dist[v] = −1 means "not visited", so setting dist marks the node visited.
 *  Display only; src/algorithms/_code runs them against `reference`. */

import { listing } from '@/algorithms/_code/listing';
import type { CodeListing, RealLanguage } from '@/algorithms/types';

const N = 7;

export const code: Record<string, Partial<Record<RealLanguage, CodeListing>>> = {
  queue: {
    js: listing(N, [
      ['function bfs(adj, s) {'],
      ['  const dist = new Array(adj.length).fill(-1);', 1],
      ['  dist[s] = 0;', 1],
      ['  const queue = [s];', 1],
      ['  while (queue.length > 0) {', 2],
      ['    const u = queue.shift();', 3],
      ['    for (const v of adj[u]) { // adj[u] sorted ascending', 4],
      ['      if (dist[v] === -1) {', 5],
      ['        dist[v] = dist[u] + 1;', 6],
      ['        queue.push(v);', 7],
      ['      }'],
      ['    }'],
      ['  }'],
      ['  return dist;'],
      ['}'],
    ]),
    python: listing(N, [
      ['def bfs(adj, s):'],
      ['    dist = [-1] * len(adj)', 1],
      ['    dist[s] = 0', 1],
      ['    queue = deque([s])', 1],
      ['    while queue:', 2],
      ['        u = queue.popleft()', 3],
      ['        for v in adj[u]:  # adj[u] sorted ascending', 4],
      ['            if dist[v] == -1:', 5],
      ['                dist[v] = dist[u] + 1', 6],
      ['                queue.append(v)', 7],
      ['    return dist'],
    ]),
    cpp: listing(N, [
      ['vector<int> bfs(const vector<vector<int>>& adj, int s) {'],
      ['    vector<int> dist(adj.size(), -1);', 1],
      ['    dist[s] = 0;', 1],
      ['    queue<int> q;', 1],
      ['    q.push(s);', 1],
      ['    while (!q.empty()) {', 2],
      ['        int u = q.front();', 3],
      ['        q.pop();', 3],
      ['        for (int v : adj[u]) { // adj[u] sorted ascending', 4],
      ['            if (dist[v] == -1) {', 5],
      ['                dist[v] = dist[u] + 1;', 6],
      ['                q.push(v);', 7],
      ['            }'],
      ['        }'],
      ['    }'],
      ['    return dist;'],
      ['}'],
    ]),
    java: listing(N, [
      ['static int[] bfs(List<List<Integer>> adj, int s) {'],
      ['    int[] dist = new int[adj.size()];', 1],
      ['    Arrays.fill(dist, -1);', 1],
      ['    dist[s] = 0;', 1],
      ['    ArrayDeque<Integer> queue = new ArrayDeque<>();', 1],
      ['    queue.add(s);', 1],
      ['    while (!queue.isEmpty()) {', 2],
      ['        int u = queue.poll();', 3],
      ['        for (int v : adj.get(u)) { // adj.get(u) sorted ascending', 4],
      ['            if (dist[v] == -1) {', 5],
      ['                dist[v] = dist[u] + 1;', 6],
      ['                queue.add(v);', 7],
      ['            }'],
      ['        }'],
      ['    }'],
      ['    return dist;'],
      ['}'],
    ]),
  },
};

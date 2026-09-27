/** Real-language listings for Dijkstra with lazy deletion, line-mapped to the
 *  pseudocode in index.ts. `adj[u]` lists (v, w) pairs sorted by v, which is
 *  what "ascending v" in the pseudocode relies on. The queue pops by (dist, id):
 *  pairs compare that way in C++ and Python; Java and JS spell it out. Line 5
 *  ("mark u settled") is the fresh-entry check itself: passing it settles u.
 *  Display only; src/algorithms/_code runs them against `reference`. */

import { listing } from '@/algorithms/_code/listing';
import type { CodeListing, RealLanguage } from '@/algorithms/types';

const N = 9;

export const code: Record<string, Partial<Record<RealLanguage, CodeListing>>> = {
  lazy: {
    js: listing(N, [
      ['function dijkstra(adj, s) {'],
      ['  const dist = new Array(adj.length).fill(Infinity);', 1],
      ['  dist[s] = 0;', 1],
      ['  const pq = [[0, s]];', 1],
      ['  while (pq.length > 0) {', 2],
      ['    const [d, u] = pq.shift();', 3],
      ['    if (d > dist[u]) continue;', [4, 5]],
      ['    for (const [v, w] of adj[u]) { // adj[u] sorted by v', 6],
      ['      if (dist[u] + w < dist[v]) {', 7],
      ['        dist[v] = dist[u] + w;', 8],
      ['        pq.push([dist[v], v]);', 9],
      ['        pq.sort((p, q) => p[0] - q[0] || p[1] - q[1]);', 9],
      ['      }'],
      ['    }'],
      ['  }'],
      ['  return dist;'],
      ['}'],
    ]),
    python: listing(N, [
      ['def dijkstra(adj, s):'],
      ["    dist = [float('inf')] * len(adj)", 1],
      ['    dist[s] = 0', 1],
      ['    pq = [(0, s)]', 1],
      ['    while pq:', 2],
      ['        d, u = heapq.heappop(pq)', 3],
      ['        if d > dist[u]:', [4, 5]],
      ['            continue', 4],
      ['        for v, w in adj[u]:  # adj[u] sorted by v', 6],
      ['            if dist[u] + w < dist[v]:', 7],
      ['                dist[v] = dist[u] + w', 8],
      ['                heapq.heappush(pq, (dist[v], v))', 9],
      ['    return dist'],
    ]),
    cpp: listing(N, [
      ['vector<int> dijkstra(const vector<vector<pair<int, int>>>& adj, int s) {'],
      ['    vector<int> dist(adj.size(), INT_MAX);', 1],
      ['    dist[s] = 0;', 1],
      ['    priority_queue<pair<int, int>, vector<pair<int, int>>, greater<>> pq;', 1],
      ['    pq.push({0, s});', 1],
      ['    while (!pq.empty()) {', 2],
      ['        auto [d, u] = pq.top();', 3],
      ['        pq.pop();', 3],
      ['        if (d > dist[u]) continue;', [4, 5]],
      ['        for (auto [v, w] : adj[u]) { // adj[u] sorted by v', 6],
      ['            if (dist[u] + w < dist[v]) {', 7],
      ['                dist[v] = dist[u] + w;', 8],
      ['                pq.push({dist[v], v});', 9],
      ['            }'],
      ['        }'],
      ['    }'],
      ['    return dist;'],
      ['}'],
    ]),
    java: listing(N, [
      ['static int[] dijkstra(List<List<int[]>> adj, int s) {'],
      ['    int[] dist = new int[adj.size()];', 1],
      ['    Arrays.fill(dist, Integer.MAX_VALUE);', 1],
      ['    dist[s] = 0;', 1],
      ['    PriorityQueue<int[]> pq = new PriorityQueue<>((p, q) -> p[0] != q[0] ? p[0] - q[0] : p[1] - q[1]);', 1],
      ['    pq.add(new int[] {0, s});', 1],
      ['    while (!pq.isEmpty()) {', 2],
      ['        int[] top = pq.poll();', 3],
      ['        int d = top[0], u = top[1];', 3],
      ['        if (d > dist[u]) continue;', [4, 5]],
      ['        for (int[] e : adj.get(u)) { // adj.get(u) sorted by v', 6],
      ['            int v = e[0], w = e[1];', 6],
      ['            if (dist[u] + w < dist[v]) {', 7],
      ['                dist[v] = dist[u] + w;', 8],
      ['                pq.add(new int[] {dist[v], v});', 9],
      ['            }'],
      ['        }'],
      ['    }'],
      ['    return dist;'],
      ['}'],
    ]),
  },
};

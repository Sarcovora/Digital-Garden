---
title: Graph Theory Primer
tags: [math]
---
A graph is a set of vertices and edges. Here is a small one:

```mermaid
graph LR
  A[Read] --> B[Note]
  B --> C[Link]
  C --> D[Review]
  D --> A
```

## Terms
- **Degree**: how many edges touch a vertex
- **Path**: a walk that never repeats a vertex
- **Connected**: a path exists between every pair

Your notes form a graph too. Each [[Home|wikilink]] is an edge.

---
title: Attention Is Linear Algebra
tags: [math, ml]
---
Scaled dot-product attention maps queries, keys and values to an output:

$$
\mathrm{Attention}(Q, K, V) = \mathrm{softmax}\!\left(\frac{Q K^{\top}}{\sqrt{d_k}}\right) V
$$

With $Q \in \mathbb{R}^{n \times d_k}$ and $K \in \mathbb{R}^{m \times d_k}$, the score matrix $QK^\top$ is $n \times m$.

## Why divide by $\sqrt{d_k}$?
If entries of $q$ and $k$ have zero mean and unit variance, then $q \cdot k$ has variance $d_k$. Dividing keeps the softmax out of its flat regions.

## A tiny implementation
```python
import numpy as np

def attention(Q, K, V):
    scores = Q @ K.T / np.sqrt(K.shape[-1])
    weights = np.exp(scores - scores.max(-1, keepdims=True))
    weights /= weights.sum(-1, keepdims=True)
    return weights @ V
```

| Symbol | Shape | Meaning |
|--------|-------|---------|
| $Q$ | $n \times d_k$ | queries |
| $K$ | $m \times d_k$ | keys |
| $V$ | $m \times d_v$ | values |

Back to [[Home]].

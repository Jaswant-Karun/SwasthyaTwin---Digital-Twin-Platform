# Unsupervised Clustering for Chronic Patient Subtyping

## Evaluated Algorithms
1. **K-Means Clustering**: Computationally efficient, clear centroid interpretability for clinical archetypes.
2. **DBSCAN**: Handles arbitrary cluster geometries but sensitive to density parameter $\epsilon$.
3. **Hierarchical Agglomerative Clustering**: Produces clear clinical dendrograms but scales poorly ($O(n^2)$ memory).

**Decision**: Utilize K-Means with PCA dimensionality reduction as the primary subtyping engine.

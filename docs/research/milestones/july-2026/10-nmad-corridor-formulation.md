# Normalized Median Absolute Deviation (nMAD) Formulation (July 10, 2026)
## Formula
$$\text{MAD} = \text{Median}(|x_i - \text{Median}(X)|)$$
$$\text{nMAD} = 1.4826 \times \text{MAD}$$
$$\text{Robust Z-Score} = \frac{x_i - \text{Median}(X)}{\text{nMAD}}$$
Tolerance corridor defined as $[\text{Median} - 2 \times \text{nMAD}, \text{Median} + 2 \times \text{nMAD}]$.

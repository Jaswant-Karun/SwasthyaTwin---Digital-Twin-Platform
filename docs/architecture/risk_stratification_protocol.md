# Risk Stratification Protocol

## Multi-Factor Risk Composites
Composite risk index evaluates weighted contributions across physiological vectors:

$$Risk_{Total} = w_{cvd} \cdot S_{cvd} + w_{met} \cdot S_{met} + w_{ren} \cdot S_{ren} + w_{lifestyle} \cdot S_{life}$$

Where weights satisfy $\sum w_i = 1.0$ and individual domain scores are bounded in $[0, 100]$.

# CI/CD Automation Pipeline Specification

## GitHub Actions Workflows
1. **Lint & Static Analysis**: Ruff (Python) and ESLint/Prettier (TypeScript).
2. **Backend Test Suite**: Pytest with pytest-cov reporting.
3. **Frontend Test Suite**: Vitest and TypeScript compiler check (`tsc --noEmit`).
4. **Container Build Verification**: Build Docker images on pull requests.

# ⚖️ Matriz de Decisão: gRPC vs REST

| Critério                | Peso | gRPC Score | REST Score | Decisão |
| ----------------------- | ---- | ---------- | ---------- | ------- |
| **Performance**         | 9    | 9          | 6          | gRPC    |
| **Facilidade de Debug** | 7    | 4          | 9          | REST    |
| **Browser Support**     | 6    | 3          | 10         | REST    |
| **Type Safety**         | 8    | 10         | 3          | gRPC    |
| **Ecosystem**           | 7    | 6          | 9          | REST    |
| **Learning Curve**      | 5    | 3          | 8          | REST    |
| **Streaming**           | 8    | 10         | 2          | gRPC    |
| **Caching**             | 6    | 3          | 9          | REST    |

**Score Final (Weighted):**
- gRPC: 6.8/10
- REST: 7.1/10

📌 Interpretação:
- Para sistemas internos de alta performance → **gRPC**
- Para APIs públicas e web apps → **REST**
- Para streaming e tempo real → **gRPC**
- Para desenvolvimento rápido → **REST**

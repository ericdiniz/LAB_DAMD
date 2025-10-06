Notas e instruções para o app `lista_compras_simples`.

Novas funcionalidades implementadas:
- Persistência local usando SharedPreferences (itens salvos como JSON)
- Animações ao inserir/remover itens e pequenas melhorias visuais
- Categorias por item (Frutas, Limpeza, Bebidas, Outros)
- Busca com debounce (300ms) e filtros por categoria + status (Todos/Comprados/Pendentes)
- Compartilhamento da lista como Texto ou CSV via intent (share_plus)

Como rodar:

1. Abra a pasta `lab04-flutter/lista_compras_simples` no VS Code ou terminal.
2. Execute:

```bash
flutter pub get
flutter run
```

Notas:
- Os dados são salvos automaticamente ao adicionar/editar/remover itens.
- Dependências principais: `shared_preferences`, `share_plus`.

Próximos possíveis passos que posso implementar:
- Adicionar testes unitários básicos.
- Melhorar a UI com temas e assets.
- Exportar/importar listas em arquivos locais.

# Relatório - Laboratório 2: Interface Profissional

## 1. Implementações Realizadas
- Tela de formulário separada (`lib/screens/task_form_screen.dart`) para criação/edição de tarefas com validação.
- Navegação entre telas usando `Navigator.push`/`pop` (lista ↔ formulário).
- Modelo `Task` em `lib/models/task.dart` com `copyWith`, `toMap`/`fromMap` para persistência.
- Persistência local via SQLite usando `sqflite` em `lib/services/database_service.dart`.
- Widget de apresentação `TaskCard` (`lib/widgets/task_card.dart`) com cores e ícones por prioridade.
- Tela principal `TaskListScreen` com filtros, card de estatísticas, busca, ordenação, estados vazios e pull-to-refresh.
- Theming Material Design 3 com suporte a tema claro/escuro (`useMaterial3`, `ColorScheme.fromSeed`) em `lib/main.dart`.
- Feedbacks de UX: SnackBars para confirmar ações, `AlertDialog` para exclusões e indicadores de loading.

Componentes Material Design 3 utilizados:
- Cards, FloatingActionButton, TextFormField (outlined/filled), DropdownButtonFormField, SwitchListTile, SnackBar, AlertDialog, RefreshIndicator.

## 2. Desafios Encontrados
- Problemas de code signing e CocoaPods ao rodar no iOS em máquina local (resolvidos removendo atributos estendidos e configurando signing no Xcode).
- Ajustes de layout para manter legibilidade em estado `completed` (riscado + redução de contraste). Solução: condicional de estilo no `TaskCard`.
- Garantir que operações assíncronas não chamassem `setState` após `dispose` — resolvido adicionando checagens `if (mounted)`.

## 3. Melhorias Implementadas (além do roteiro)
- Suporte a tema escuro com `themeMode: ThemeMode.system`.
- Barra de busca por título/descrição e menu de ordenação (data/prioridade/título).
- Pequenos comentários e organização de helpers para facilitar manutenção.

## 4. Aprendizados
- Uso de `sqflite` para persistência local e mapeamento `toMap`/`fromMap` do modelo.
- Boas práticas em formulários Flutter: `GlobalKey<FormState>`, validação e tratamento de estados (loading, sucesso, erro).
- Importância do design de interação: feedbacks imediatos (SnackBars/Dialogs) melhoram a experiência do usuário.

## 5. Próximos Passos
- Implementar ao menos dois exercícios complementares: sugeridos `Data de Vencimento` e `Categorias`.
- Adicionar testes automatizados (widget tests) cobrindo criação/edição/validação/filtros.
- Melhorias de acessibilidade: labels semânticos, contraste de cores e testes em diferentes tamanhos de fonte.

---

Arquivo(s) principais alterados:
- `lib/main.dart` (tema, Material 3)
- `lib/screens/task_list_screen.dart` (lista, filtros, busca, ordenação)
- `lib/screens/task_form_screen.dart` (formulário)
- `lib/widgets/task_card.dart` (UI do card)
- `lib/models/task.dart` (modelo)
- `lib/services/database_service.dart` (persistência)

Data: 25/10/2025
Autor: Equipe de desenvolvimento / aluno

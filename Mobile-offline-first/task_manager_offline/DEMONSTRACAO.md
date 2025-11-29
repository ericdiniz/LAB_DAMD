# Roteiro de Demonstração - Offline-First

Este roteiro orienta a apresentação do aplicativo **Task Manager Offline** (passos 1–9). Ele evidencia o comportamento offline-first, a fila de sincronização e a resolução de conflitos usando o servidor REST do roteiro 1.

## Pré-requisitos

1. Servidor backend tradicional em execução

   ```bash
   cd lab01-servidor-tradicional
   npm install
   npm run start
   ```

2. Dependências Flutter instaladas no projeto offline-first

   ```bash
   cd lab07-flutter-offline/task_manager_offline
   flutter pub get
   ```

3. Emulador ou dispositivo configurado (Android ou iOS)
4. App iniciado em modo debug

   ```bash
   flutter run --debug --device-id <ID_DO_DISPOSITIVO>
   ```

## Cenário 1 – Criação Offline

**Objetivo:** Demonstrar que a criação e a persistência local funcionam sem rede.

1. Desabilite Wi-Fi/dados móveis do dispositivo.
2. Observe o indicador vermelho "Modo offline" no app.
3. Toque em **Nova tarefa** e crie uma tarefa (ex.: "Comprar leite").
4. Confira o badge de sincronização ⏱ na tarefa criada.
5. Reabilite a conectividade.
6. Aguarde a sincronização automática (badge muda para ✓).

**Resultado esperado:** A tarefa permanece visível mesmo sem rede e sincroniza ao voltar online.

## Cenário 2 – Edição com Conflito (Last-Write-Wins)

**Objetivo:** Mostrar a resolução automática de conflitos.

1. Com conexão ativa, crie a tarefa "Revisar código" e aguarde o status ✓.
2. Desabilite a conexão do dispositivo.
3. Edite a mesma tarefa localmente, alterando o título.
4. No servidor (via REST client, curl ou `lab01`), altere a mesma tarefa para outro valor.
5. Reabilite a conexão no dispositivo.
6. Observe o snackbar de sincronização e verifique o log (conflicto resolvido).
7. Valide que a versão mais recente (com timestamp maior) prevaleceu.

**Resultado esperado:** O motor LWW decide entre as versões e mantém a coerência local/servidor.

## Cenário 3 – Fila de Operações

**Objetivo:** Evidenciar o enfileiramento e replay automático das operações.

1. Desative a conexão.
2. Crie três tarefas (A, B, C).
3. Edite a tarefa A.
4. Exclua a tarefa B.
5. Abra o **painel de status** (ícone de dashboard) e observe:
   - Contagem de tarefas não sincronizadas.
   - Operações pendentes na fila.
6. Volte a conectar-se.
7. Acompanhe o processamento da fila (badges mudam para ✓ e fila zera).

**Resultado esperado:** As cinco operações são executadas em ordem assim que a rede retorna.

## Cenário 4 – Indicadores Visuais e Experiência do Usuário

**Objetivo:** Destacar feedbacks de UX implementados.

1. Observe o indicador de conectividade (verde/laranja) no rodapé.
2. Note os badges de prioridade, categoria, fotos e status de sync em cada card.
3. Use o botão de sincronização manual para forçar uma sync (SnackBar "Sincronizando...").
4. Faça pull-to-refresh para atualizar manualmente a lista.
5. Valide a tela de **Status da sincronização** (totais, pendências, fila, última sync).

## Cenário 5 – Persistência Local

**Objetivo:** Confirmar que os dados permanecem no SQLite mesmo com o app fechado.

1. Desconecte o dispositivo.
2. Crie uma tarefa enquanto offline.
3. Feche totalmente o app.
4. Reabra o app ainda offline.
5. Verifique que a tarefa permanece listada.
6. Reconecte e aguarde a sincronização.

**Resultado esperado:** Tarefas persistem localmente e sincronizam ao restabelecer a conexão.

---

## Troubleshooting Rápido

- **Nenhuma câmera detectada:** Execute `await CameraService.instance.initialize()` no `main.dart` (modo legacy) antes de alternar o flag `kEnableOfflineFirstApp` para false.
- **API inacessível:** Valide o host/porta configurados em `offline_first/services/api_service.dart` para iOS (`localhost`) ou Android (`10.0.2.2`).
- **Banco inconsistente:** Use `OfflineDatabaseService.instance.clearAllData()` em um `debugPrint` temporário para resetar o SQLite durante testes.
- **Fila não processa:** Cheque se há conectividade (`SyncStatusScreen`) e se o backend está ativo.

A execução completa dos cenários acima cobre o requisito do **Passo 10** do roteiro.

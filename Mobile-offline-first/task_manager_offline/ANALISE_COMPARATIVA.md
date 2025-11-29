# Análise Comparativa: Offline-First vs REST vs gRPC

## Comparação de Arquiteturas

| Aspecto                | REST (Roteiro 1)   | gRPC (Roteiro 2)   | Offline-First (Roteiro 3) |
| ---------------------- | ------------------ | ------------------ | ------------------------- |
| **Latência Percebida** | 50-100ms           | 20-40ms            | <10ms (local)             |
| **Disponibilidade**    | Requer conexão     | Requer conexão     | **100% (offline)**        |
| **Resiliência**        | Baixa              | Baixa              | **Alta**                  |
| **Complexidade**       | Baixa              | Alta               | **Muito Alta**            |
| **Consistência**       | Forte              | Forte              | **Eventual**              |
| **Uso de Dados**       | Alto               | Médio              | **Baixo**                 |
| **Experiência UX**     | Dependente de rede | Dependente de rede | **Fluida**                |
| **Sincronização**      | Síncrona           | Síncrona           | **Assíncrona**            |
| **Conflitos**          | N/A                | N/A                | **Possíveis**             |
| **Armazenamento**      | Servidor only      | Servidor only      | **Local + Servidor**      |

## Métricas Coletadas

### Operações Locais (Offline-First)
- Criar tarefa: **<10ms**
- Listar tarefas: **<5ms**
- Atualizar tarefa: **<10ms**

### Operações com Rede (REST)
- Criar tarefa: **80-150ms**
- Listar tarefas: **100-200ms**
- Atualizar tarefa: **80-150ms**

### Operações com Rede (gRPC)
- Criar tarefa: **30-60ms**
- Listar tarefas: **40-80ms**
- Atualizar tarefa: **30-60ms**

## Conclusão

O paradigma Offline-First oferece a **melhor experiência do usuário** ao custo de
**maior complexidade de implementação**. Use Offline-First quando a
**disponibilidade** e **experiência do usuário** são mais importantes que a
**simplicidade de implementação**.

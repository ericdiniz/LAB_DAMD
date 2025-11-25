# Roteiro de Testes do Lab01 (Servidor Tradicional)

Este guia executa os testes básicos da API de tarefas implementada no Lab01. Os comandos assumem macOS com shell `zsh` e o projeto clonado em `~/Documents/GitHub/LAB_DAMD/lab01-servidor-tradicional`.

---

## Passo 1: Preparar o Ambiente

```bash
# Ir para a pasta do servidor tradicional
cd ~/Documents/GitHub/LAB_DAMD/lab01-servidor-tradicional

# Instalar as dependências
npm install
```

---

## Passo 2: Iniciar o Servidor

```bash
# Ainda na pasta do projeto
npm run dev
```

- Aguarde o log `Servidor iniciado na porta 3000`.
- Mantenha este terminal aberto para observar os logs do servidor.

---

## Passo 3: Abrir um Novo Terminal para Testes

- Abra uma nova aba/janela no terminal (`⌘T` no Terminal.app ou `⌘D` no iTerm2).
- Certifique-se de estar no diretório do projeto:

```bash
cd ~/Documents/GitHub/LAB_DAMD/lab01-servidor-tradicional
```

---

## Passo 4: Registrar Usuário

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","username":"testuser","password":"123456","firstName":"Joao","lastName":"Silva"}'
```

> Caso o usuário já exista, o servidor retornará HTTP 409. Prossiga para o login mesmo assim.

---

## Passo 5: Fazer Login

a) Executar o login e capturar o token (campo `data.token` da resposta):

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"user@test.com","password":"123456"}'
```

b) Armazenar o token em uma variável de ambiente (substitua `SEU_TOKEN_AQUI` pelo valor obtido na etapa anterior):

```bash
TOKEN=asdasda          # comando pedido para manter a constante disponível
# TOKEN=SEU_TOKEN_REAL # use esta linha após copiar o token retornado pelo login
```

> Em `zsh`, a variável fica disponível apenas na aba atual. Repita o comando se abrir outro terminal.

---

## Passo 6: Criar Tarefa

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Minha Tarefa","description":"Descricao","priority":"high"}'
```

> Use letras sem acentos se preferir evitar problemas de codificação no terminal.

---

## Passo 7: Listar Tarefas

```bash
curl -X GET http://localhost:3000/api/tasks \
  -H "Authorization: Bearer $TOKEN"
```

- Verifique se a resposta contém a tarefa recém-criada.
- Caso receba HTTP 401, confirme se a variável `TOKEN` está definida com o valor atual.

---

## Encerramento

- Para parar o servidor, volte ao terminal onde ele está rodando e pressione `Ctrl+C`.
- Refaça o roteiro sempre que precisar validar o ambiente do Lab01.

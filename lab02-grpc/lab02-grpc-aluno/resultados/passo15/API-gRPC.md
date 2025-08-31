# API gRPC - Sistema de Gerenciamento de Tarefas

## Endpoints de Autenticação

### AuthService.Register

**Request:**

```protobuf
{
  email: string
  username: string
  password: string
  first_name: string
  last_name: string
}
```

**Response:**

```protobuf
{
  success: bool
  message: string
  user: User
  token: string
  errors: string[]
}
```

### AuthService.Login

**Request:**

```protobuf
{
  identifier: string  // email ou username
  password: string
}
```

**Response:**

```protobuf
{
  success: bool
  message: string
  user: User
  token: string
  errors: string[]
}
```

## Endpoints de Tarefas

### TaskService.CreateTask

**Request:**

```protobuf
{
  token: string
  title: string
  description: string
  priority: Priority (LOW=0, MEDIUM=1, HIGH=2, URGENT=3)
}
```

### TaskService.GetTasks (com paginação)

**Request:**

```protobuf
{
  token: string
  completed: bool (optional)
  priority: Priority (optional)
  page: int32
  limit: int32
}
```

### TaskService.StreamTasks (Server Streaming)

**Request:**

```protobuf
{
  token: string
  completed: bool (optional)
}
```

**Response Stream:**

```protobuf
Task {
  id: string
  title: string
  description: string
  completed: bool
  priority: Priority
  user_id: string
  created_at: int64
  updated_at: int64
}
```

### TaskService.StreamNotifications (Server Streaming)

**Response Stream:**

```protobuf
TaskNotification {
  type: NotificationType
  task: Task
  message: string
  timestamp: int64
}
```

## Tipos de Dados

### Priority (Enum)

- LOW = 0
- MEDIUM = 1
- HIGH = 2
- URGENT = 3

### NotificationType (Enum)

- TASK_CREATED = 0
- TASK_UPDATED = 1
- TASK_DELETED = 2
- TASK_COMPLETED = 3

## Códigos de Erro gRPC

| Código | Nome             | Descrição                |
| ------ | ---------------- | ------------------------ |
| 0      | OK               | Sucesso                  |
| 3      | INVALID_ARGUMENT | Dados inválidos          |
| 16     | UNAUTHENTICATED  | Token inválido/ausente   |
| 5      | NOT_FOUND        | Recurso não encontrado   |
| 13     | INTERNAL         | Erro interno do servidor |

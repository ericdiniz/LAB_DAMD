# API gRPC — Sistema de Tarefas

## AuthService

### Register
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

### Login
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

---

## TaskService

### CreateTask
**Request:**
```protobuf
{
  token: string
  title: string
  description: string
  priority: Priority  // 0=LOW, 1=MEDIUM, 2=HIGH, 3=URGENT
}
```

### GetTasks (paginação)
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

### GetStats
**Request:**
```protobuf
{
  token: string
}
```

**Response:**
```protobuf
{
  success: bool
  stats: {
    total: int32
    completed: int32
    pending: int32
    completion_rate: float
  }
}
```

### UpdateTask
**Request:**
```protobuf
{
  token: string
  id: string
  title: string (optional)
  description: string (optional)
  completed: bool (optional)
  priority: Priority (optional)
}
```

### DeleteTask
**Request:**
```protobuf
{
  token: string
  id: string
}
```

### StreamTasks (Server Streaming)
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

### StreamNotifications (Server Streaming)
**Response Stream:**
```protobuf
TaskNotification {
  type: NotificationType
  task: Task
  message: string
  timestamp: int64
}
```

---

## Tipos de Dados

### User
```protobuf
User {
  id: string
  email: string
  username: string
  first_name: string
  last_name: string
  created_at: int64
}
```

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

---

## Códigos de Erro gRPC
| Código | Nome               | Descrição                |
|-------:|--------------------|--------------------------|
| 0      | OK                 | Sucesso                  |
| 3      | INVALID_ARGUMENT   | Dados inválidos          |
| 5      | NOT_FOUND          | Recurso não encontrado   |
| 13     | INTERNAL           | Erro interno do servidor |
| 16     | UNAUTHENTICATED    | Token inválido/ausente   |

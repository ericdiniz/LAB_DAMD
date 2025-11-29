# Roteiro 3: Paradigma Offline-First com Sincronização em Flutter

**Laboratório de Desenvolvimento de Aplicações Móveis e Distribuídas**
**Curso de Engenharia de Software - PUC Minas**
**Professores:** Artur Mol, Cleiton Tavares e Cristiano Neto

---

## Objetivos

- Implementar o paradigma Offline-First em aplicações móveis Flutter
- Compreender estratégias de sincronização de dados em ambientes móveis
- Desenvolver mecanismos de detecção e resolução de conflitos
- Implementar persistência local com SQLite e Hive
- Garantir funcionamento da aplicação em ambientes com conectividade intermitente
- Estabelecer base para aplicações móveis resilientes

## Fundamentação Teórica

Segundo Kleppmann (2017), "aplicações offline-first são projetadas para funcionar sem conexão de rede e sincronizar dados quando a conectividade é restaurada" <sup>[1]</sup>. Este paradigma é essencial para aplicações móveis que operam em ambientes com conectividade não confiável.

### Características do Paradigma Offline-First

**Princípios Fundamentais:**

- **Local-First**: Dados são armazenados e manipulados localmente primeiro
- **Sincronização Eventual**: Dados são sincronizados quando conectividade está disponível
- **Resolução de Conflitos**: Estratégias para lidar com modificações concorrentes
- **Experiência Contínua**: Aplicação funciona independente do estado da rede

**Vantagens:**

- Melhor experiência do usuário em redes instáveis
- Redução de latência para operações locais
- Maior resiliência e disponibilidade
- Economia de dados móveis

**Desafios:**

- Complexidade na sincronização de dados
- Gerenciamento de conflitos
- Consistência eventual vs forte
- Limitações de armazenamento em dispositivos móveis

### Estratégias de Sincronização em Flutter

1. **Last-Write-Wins (LWW)**: Última modificação prevalece
2. **Version Vectors**: Rastreamento de versões distribuídas
3. **Timestamp-based**: Sincronização baseada em timestamps
4. **Queue-based**: Fila de operações offline

## Cenário do Laboratório

Evolução do sistema de gerenciamento de tarefas implementando:

1. Persistência local com SQLite (sqflite)
2. Detecção de estado de conectividade (connectivity_plus)
3. Fila de sincronização para operações offline
4. Mecanismo de resolução de conflitos
5. Sincronização automática e manual
6. Indicadores visuais de estado de sincronização

## Pré-requisitos

- Flutter SDK 3.0+
- Dart 3.0+
- Conhecimento dos Roteiros 1 e 2
- Servidor REST do Roteiro 1 rodando
- Dispositivo/Emulador Android ou iOS

---

## **PASSO 1: Configuração Inicial do Projeto Flutter**

### 1.1 Criar Projeto Flutter

```bash
flutter create task_manager_offline
cd task_manager_offline
```

### 1.2 Configurar Dependências (`pubspec.yaml`)

```yaml
name: task_manager_offline
description: Sistema de gerenciamento de tarefas com suporte offline-first
version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter

  # Persistência local
  sqflite: ^2.3.0
  path: ^1.8.3

  # Conectividade
  connectivity_plus: ^5.0.0

  # HTTP
  http: ^1.1.0

  # Gerenciamento de estado
  provider: ^6.1.0

  # Utilities
  uuid: ^4.0.0
  intl: ^0.18.0
  shared_preferences: ^2.2.2

  # UI
  flutter_slidable: ^3.0.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0

flutter:
  uses-material-design: true
```

### 1.3 Instalar Dependências

```bash
flutter pub get
```

### 1.4 Estrutura de Diretórios

```
lib/
├── main.dart
├── models/
│   ├── task.dart              # Modelo de tarefa
│   └── sync_operation.dart    # Modelo de operação de sync
├── services/
│   ├── database_service.dart  # Serviço de banco de dados
│   ├── api_service.dart       # Serviço de API REST
│   ├── sync_service.dart      # Motor de sincronização
│   └── connectivity_service.dart # Monitoramento de conectividade
├── providers/
│   ├── task_provider.dart     # Provider de tarefas
│   └── sync_provider.dart     # Provider de sincronização
├── screens/
│   ├── home_screen.dart       # Tela principal
│   ├── task_form_screen.dart  # Formulário de tarefa
│   └── sync_status_screen.dart # Status de sincronização
├── widgets/
│   ├── task_card.dart         # Card de tarefa
│   ├── sync_indicator.dart    # Indicador de sync
│   └── conflict_dialog.dart   # Diálogo de conflito
└── utils/
    ├── constants.dart         # Constantes
    └── conflict_resolver.dart # Resolução de conflitos
```

---

## **PASSO 2: Modelos de Dados**

### 2.1 Modelo de Tarefa (`lib/models/task.dart`)

```dart
import 'package:uuid/uuid.dart';

/// Modelo de Tarefa com suporte a sincronização offline
class Task {
  final String id;
  final String title;
  final String description;
  final bool completed;
  final String priority;
  final String userId;
  final DateTime createdAt;
  final DateTime updatedAt;
  final int version;

  // Campos de sincronização
  final SyncStatus syncStatus;
  final DateTime? localUpdatedAt;

  Task({
    String? id,
    required this.title,
    required this.description,
    this.completed = false,
    this.priority = 'medium',
    this.userId = 'user1',
    DateTime? createdAt,
    DateTime? updatedAt,
    this.version = 1,
    this.syncStatus = SyncStatus.synced,
    this.localUpdatedAt,
  })  : id = id ?? const Uuid().v4(),
        createdAt = createdAt ?? DateTime.now(),
        updatedAt = updatedAt ?? DateTime.now();

  /// Criar cópia com modificações
  Task copyWith({
    String? title,
    String? description,
    bool? completed,
    String? priority,
    DateTime? updatedAt,
    int? version,
    SyncStatus? syncStatus,
    DateTime? localUpdatedAt,
  }) {
    return Task(
      id: id,
      title: title ?? this.title,
      description: description ?? this.description,
      completed: completed ?? this.completed,
      priority: priority ?? this.priority,
      userId: userId,
      createdAt: createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      version: version ?? this.version,
      syncStatus: syncStatus ?? this.syncStatus,
      localUpdatedAt: localUpdatedAt ?? this.localUpdatedAt,
    );
  }

  /// Converter para Map (para banco de dados)
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'completed': completed ? 1 : 0,
      'priority': priority,
      'userId': userId,
      'createdAt': createdAt.millisecondsSinceEpoch,
      'updatedAt': updatedAt.millisecondsSinceEpoch,
      'version': version,
      'syncStatus': syncStatus.toString(),
      'localUpdatedAt': localUpdatedAt?.millisecondsSinceEpoch,
    };
  }

  /// Criar Task a partir de Map
  factory Task.fromMap(Map<String, dynamic> map) {
    return Task(
      id: map['id'],
      title: map['title'],
      description: map['description'],
      completed: map['completed'] == 1,
      priority: map['priority'],
      userId: map['userId'],
      createdAt: DateTime.fromMillisecondsSinceEpoch(map['createdAt']),
      updatedAt: DateTime.fromMillisecondsSinceEpoch(map['updatedAt']),
      version: map['version'],
      syncStatus: SyncStatus.values.firstWhere(
        (e) => e.toString() == map['syncStatus'],
        orElse: () => SyncStatus.synced,
      ),
      localUpdatedAt: map['localUpdatedAt'] != null
          ? DateTime.fromMillisecondsSinceEpoch(map['localUpdatedAt'])
          : null,
    );
  }

  /// Converter para JSON (para API)
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'completed': completed,
      'priority': priority,
      'userId': userId,
      'createdAt': createdAt.millisecondsSinceEpoch,
      'updatedAt': updatedAt.millisecondsSinceEpoch,
      'version': version,
    };
  }

  /// Criar Task a partir de JSON
  factory Task.fromJson(Map<String, dynamic> json) {
    return Task(
      id: json['id'],
      title: json['title'],
      description: json['description'] ?? '',
      completed: json['completed'] ?? false,
      priority: json['priority'] ?? 'medium',
      userId: json['userId'] ?? json['user_id'] ?? 'user1',
      createdAt: DateTime.fromMillisecondsSinceEpoch(json['createdAt']),
      updatedAt: DateTime.fromMillisecondsSinceEpoch(json['updatedAt']),
      version: json['version'] ?? 1,
      syncStatus: SyncStatus.synced,
    );
  }

  @override
  String toString() {
    return 'Task(id: $id, title: $title, syncStatus: $syncStatus)';
  }
}

/// Status de sincronização da tarefa
enum SyncStatus {
  synced,    // Sincronizada com servidor
  pending,   // Pendente de sincronização
  conflict,  // Conflito detectado
  error,     // Erro na sincronização
}

extension SyncStatusExtension on SyncStatus {
  String get displayName {
    switch (this) {
      case SyncStatus.synced:
        return 'Sincronizada';
      case SyncStatus.pending:
        return 'Pendente';
      case SyncStatus.conflict:
        return 'Conflito';
      case SyncStatus.error:
        return 'Erro';
    }
  }

  String get icon {
    switch (this) {
      case SyncStatus.synced:
        return '✓';
      case SyncStatus.pending:
        return '⏱';
      case SyncStatus.conflict:
        return '⚠';
      case SyncStatus.error:
        return '✗';
    }
  }
}
```

### 2.2 Modelo de Operação de Sincronização (`lib/models/sync_operation.dart`)

```dart
import 'package:uuid/uuid.dart';

/// Operação de sincronização pendente
class SyncOperation {
  final String id;
  final OperationType type;
  final String taskId;
  final Map<String, dynamic> data;
  final DateTime timestamp;
  final int retries;
  final SyncOperationStatus status;
  final String? error;

  SyncOperation({
    String? id,
    required this.type,
    required this.taskId,
    required this.data,
    DateTime? timestamp,
    this.retries = 0,
    this.status = SyncOperationStatus.pending,
    this.error,
  })  : id = id ?? const Uuid().v4(),
        timestamp = timestamp ?? DateTime.now();

  /// Criar cópia com modificações
  SyncOperation copyWith({
    OperationType? type,
    String? taskId,
    Map<String, dynamic>? data,
    DateTime? timestamp,
    int? retries,
    SyncOperationStatus? status,
    String? error,
  }) {
    return SyncOperation(
      id: id,
      type: type ?? this.type,
      taskId: taskId ?? this.taskId,
      data: data ?? this.data,
      timestamp: timestamp ?? this.timestamp,
      retries: retries ?? this.retries,
      status: status ?? this.status,
      error: error ?? this.error,
    );
  }

  /// Converter para Map
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'type': type.toString(),
      'taskId': taskId,
      'data': data.toString(),
      'timestamp': timestamp.millisecondsSinceEpoch,
      'retries': retries,
      'status': status.toString(),
      'error': error,
    };
  }

  /// Criar a partir de Map
  factory SyncOperation.fromMap(Map<String, dynamic> map) {
    return SyncOperation(
      id: map['id'],
      type: OperationType.values.firstWhere(
        (e) => e.toString() == map['type'],
      ),
      taskId: map['taskId'],
      data: _parseData(map['data']),
      timestamp: DateTime.fromMillisecondsSinceEpoch(map['timestamp']),
      retries: map['retries'],
      status: SyncOperationStatus.values.firstWhere(
        (e) => e.toString() == map['status'],
      ),
      error: map['error'],
    );
  }

  static Map<String, dynamic> _parseData(String dataStr) {
    // Implementação simplificada - em produção use json.decode
    return {};
  }

  @override
  String toString() {
    return 'SyncOperation(type: $type, taskId: $taskId, status: $status)';
  }
}

/// Tipo de operação
enum OperationType {
  create,
  update,
  delete,
}

/// Status da operação de sincronização
enum SyncOperationStatus {
  pending,
  processing,
  completed,
  failed,
}
```

---

## **PASSO 3: Serviço de Banco de Dados Local**

### 3.1 Database Service (`lib/services/database_service.dart`)

```dart
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import '../models/task.dart';
import '../models/sync_operation.dart';

/// Serviço de gerenciamento do banco de dados SQLite local
class DatabaseService {
  static final DatabaseService instance = DatabaseService._init();
  static Database? _database;

  DatabaseService._init();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB('task_manager_offline.db');
    return _database!;
  }

  Future<Database> _initDB(String filePath) async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, filePath);

    return await openDatabase(
      path,
      version: 1,
      onCreate: _createDB,
    );
  }

  Future<void> _createDB(Database db, int version) async {
    // Tabela de tarefas
    await db.execute('''
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        completed INTEGER NOT NULL DEFAULT 0,
        priority TEXT NOT NULL,
        userId TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        syncStatus TEXT NOT NULL,
        localUpdatedAt INTEGER
      )
    ''');

    // Tabela de fila de sincronização
    await db.execute('''
      CREATE TABLE sync_queue (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        taskId TEXT NOT NULL,
        data TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        retries INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        error TEXT
      )
    ''');

    // Tabela de metadados
    await db.execute('''
      CREATE TABLE metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    ''');

    // Índices para otimização
    await db.execute('CREATE INDEX idx_tasks_userId ON tasks(userId)');
    await db.execute('CREATE INDEX idx_tasks_syncStatus ON tasks(syncStatus)');
    await db.execute('CREATE INDEX idx_sync_queue_status ON sync_queue(status)');

    print('✅ Banco de dados criado com sucesso');
  }

  // ==================== OPERAÇÕES DE TAREFAS ====================

  /// Inserir ou atualizar tarefa
  Future<Task> upsertTask(Task task) async {
    final db = await database;
    await db.insert(
      'tasks',
      task.toMap(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
    return task;
  }

  /// Buscar tarefa por ID
  Future<Task?> getTask(String id) async {
    final db = await database;
    final maps = await db.query(
      'tasks',
      where: 'id = ?',
      whereArgs: [id],
    );

    if (maps.isEmpty) return null;
    return Task.fromMap(maps.first);
  }

  /// Buscar todas as tarefas
  Future<List<Task>> getAllTasks({String userId = 'user1'}) async {
    final db = await database;
    final maps = await db.query(
      'tasks',
      where: 'userId = ?',
      whereArgs: [userId],
      orderBy: 'updatedAt DESC',
    );

    return maps.map((map) => Task.fromMap(map)).toList();
  }

  /// Buscar tarefas não sincronizadas
  Future<List<Task>> getUnsyncedTasks() async {
    final db = await database;
    final maps = await db.query(
      'tasks',
      where: 'syncStatus = ?',
      whereArgs: [SyncStatus.pending.toString()],
    );

    return maps.map((map) => Task.fromMap(map)).toList();
  }

  /// Buscar tarefas com conflito
  Future<List<Task>> getConflictedTasks() async {
    final db = await database;
    final maps = await db.query(
      'tasks',
      where: 'syncStatus = ?',
      whereArgs: [SyncStatus.conflict.toString()],
    );

    return maps.map((map) => Task.fromMap(map)).toList();
  }

  /// Deletar tarefa
  Future<int> deleteTask(String id) async {
    final db = await database;
    return await db.delete(
      'tasks',
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  /// Atualizar status de sincronização
  Future<void> updateSyncStatus(String id, SyncStatus status) async {
    final db = await database;
    await db.update(
      'tasks',
      {'syncStatus': status.toString()},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  // ==================== FILA DE SINCRONIZAÇÃO ====================

  /// Adicionar operação à fila
  Future<SyncOperation> addToSyncQueue(SyncOperation operation) async {
    final db = await database;
    await db.insert(
      'sync_queue',
      operation.toMap(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
    return operation;
  }

  /// Obter operações pendentes
  Future<List<SyncOperation>> getPendingSyncOperations() async {
    final db = await database;
    final maps = await db.query(
      'sync_queue',
      where: 'status = ?',
      whereArgs: [SyncOperationStatus.pending.toString()],
      orderBy: 'timestamp ASC',
    );

    return maps.map((map) => SyncOperation.fromMap(map)).toList();
  }

  /// Atualizar operação de sincronização
  Future<void> updateSyncOperation(SyncOperation operation) async {
    final db = await database;
    await db.update(
      'sync_queue',
      operation.toMap(),
      where: 'id = ?',
      whereArgs: [operation.id],
    );
  }

  /// Remover operação da fila
  Future<int> removeSyncOperation(String id) async {
    final db = await database;
    return await db.delete(
      'sync_queue',
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  /// Limpar operações concluídas
  Future<int> clearCompletedOperations() async {
    final db = await database;
    return await db.delete(
      'sync_queue',
      where: 'status = ?',
      whereArgs: [SyncOperationStatus.completed.toString()],
    );
  }

  // ==================== METADADOS ====================

  /// Salvar metadado
  Future<void> setMetadata(String key, String value) async {
    final db = await database;
    await db.insert(
      'metadata',
      {'key': key, 'value': value},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  /// Obter metadado
  Future<String?> getMetadata(String key) async {
    final db = await database;
    final maps = await db.query(
      'metadata',
      where: 'key = ?',
      whereArgs: [key],
    );

    if (maps.isEmpty) return null;
    return maps.first['value'] as String;
  }

  // ==================== ESTATÍSTICAS ====================

  /// Obter estatísticas do banco de dados
  Future<Map<String, dynamic>> getStats() async {
    final db = await database;

    final totalTasks = Sqflite.firstIntValue(
      await db.rawQuery('SELECT COUNT(*) FROM tasks')
    ) ?? 0;

    final unsyncedTasks = Sqflite.firstIntValue(
      await db.rawQuery(
        'SELECT COUNT(*) FROM tasks WHERE syncStatus = ?',
        [SyncStatus.pending.toString()]
      )
    ) ?? 0;

    final queuedOperations = Sqflite.firstIntValue(
      await db.rawQuery(
        'SELECT COUNT(*) FROM sync_queue WHERE status = ?',
        [SyncOperationStatus.pending.toString()]
      )
    ) ?? 0;

    final lastSync = await getMetadata('lastSyncTimestamp');

    return {
      'totalTasks': totalTasks,
      'unsyncedTasks': unsyncedTasks,
      'queuedOperations': queuedOperations,
      'lastSync': lastSync != null ? int.parse(lastSync) : null,
    };
  }

  // ==================== UTILIDADES ====================

  /// Limpar todos os dados
  Future<void> clearAllData() async {
    final db = await database;
    await db.delete('tasks');
    await db.delete('sync_queue');
    await db.delete('metadata');
    print('🗑️ Todos os dados foram limpos');
  }

  /// Fechar banco de dados
  Future<void> close() async {
    final db = await database;
    await db.close();
  }
}
```

---

## **PASSO 4: Serviço de API REST**

### 4.1 API Service (`lib/services/api_service.dart`)

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/task.dart';

/// Serviço de comunicação com API REST do servidor
class ApiService {
  static const String baseUrl = 'http://10.0.2.2:3000/api'; // Android emulator
  // static const String baseUrl = 'http://localhost:3000/api'; // iOS simulator

  final String userId;

  ApiService({this.userId = 'user1'});

  // ==================== OPERAÇÕES DE TAREFAS ====================

  /// Buscar todas as tarefas (com sync incremental)
  Future<Map<String, dynamic>> getTasks({int? modifiedSince}) async {
    try {
      final uri = Uri.parse('$baseUrl/tasks').replace(
        queryParameters: {
          'userId': userId,
          if (modifiedSince != null) 'modifiedSince': modifiedSince.toString(),
        },
      );

      final response = await http.get(uri).timeout(
        const Duration(seconds: 10),
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return {
          'success': true,
          'tasks': (data['tasks'] as List)
              .map((json) => Task.fromJson(json))
              .toList(),
          'lastSync': data['lastSync'],
          'serverTime': data['serverTime'],
        };
      } else {
        throw Exception('Erro ao buscar tarefas: ${response.statusCode}');
      }
    } catch (e) {
      print('❌ Erro na requisição getTasks: $e');
      rethrow;
    }
  }

  /// Criar tarefa no servidor
  Future<Task> createTask(Task task) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/tasks'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(task.toJson()),
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 201) {
        final data = json.decode(response.body);
        return Task.fromJson(data['task']);
      } else {
        throw Exception('Erro ao criar tarefa: ${response.statusCode}');
      }
    } catch (e) {
      print('❌ Erro na requisição createTask: $e');
      rethrow;
    }
  }

  /// Atualizar tarefa no servidor
  Future<Map<String, dynamic>> updateTask(Task task) async {
    try {
      final response = await http.put(
        Uri.parse('$baseUrl/tasks/${task.id}'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          ...task.toJson(),
          'version': task.version,
        }),
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return {
          'success': true,
          'task': Task.fromJson(data['task']),
        };
      } else if (response.statusCode == 409) {
        // Conflito detectado
        final data = json.decode(response.body);
        return {
          'success': false,
          'conflict': true,
          'serverTask': Task.fromJson(data['serverTask']),
        };
      } else {
        throw Exception('Erro ao atualizar tarefa: ${response.statusCode}');
      }
    } catch (e) {
      print('❌ Erro na requisição updateTask: $e');
      rethrow;
    }
  }

  /// Deletar tarefa no servidor
  Future<bool> deleteTask(String id, int version) async {
    try {
      final response = await http.delete(
        Uri.parse('$baseUrl/tasks/$id?version=$version'),
      ).timeout(const Duration(seconds: 10));

      return response.statusCode == 200 || response.statusCode == 404;
    } catch (e) {
      print('❌ Erro na requisição deleteTask: $e');
      rethrow;
    }
  }

  /// Sincronização em lote
  Future<List<Map<String, dynamic>>> syncBatch(
    List<Map<String, dynamic>> operations,
  ) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/sync/batch'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'operations': operations}),
      ).timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return List<Map<String, dynamic>>.from(data['results']);
      } else {
        throw Exception('Erro no sync em lote: ${response.statusCode}');
      }
    } catch (e) {
      print('❌ Erro na requisição syncBatch: $e');
      rethrow;
    }
  }

  /// Verificar conectividade com servidor
  Future<bool> checkConnectivity() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/health'),
      ).timeout(const Duration(seconds: 5));

      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }
}
```

---

## **PASSO 5: Serviço de Conectividade**

### 5.1 Connectivity Service (`lib/services/connectivity_service.dart`)

```dart
import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';

/// Serviço de monitoramento de conectividade de rede
class ConnectivityService {
  static final ConnectivityService instance = ConnectivityService._init();

  final Connectivity _connectivity = Connectivity();
  final _connectivityController = StreamController<bool>.broadcast();

  bool _isOnline = false;
  StreamSubscription? _subscription;

  ConnectivityService._init();

  /// Stream de status de conectividade
  Stream<bool> get connectivityStream => _connectivityController.stream;

  /// Status atual de conectividade
  bool get isOnline => _isOnline;

  /// Inicializar monitoramento
  Future<void> initialize() async {
    // Verificar estado inicial
    final result = await _connectivity.checkConnectivity();
    _updateStatus(result);

    // Escutar mudanças
    _subscription = _connectivity.onConnectivityChanged.listen(_updateStatus);

    print('✅ Serviço de conectividade inicializado');
  }

  void _updateStatus(ConnectivityResult result) {
    final wasOnline = _isOnline;
    _isOnline = result != ConnectivityResult.none;

    if (wasOnline != _isOnline) {
      print(_isOnline ? '🟢 Conectado à internet' : '🔴 Sem conexão à internet');
      _connectivityController.add(_isOnline);
    }
  }

  /// Verificar conectividade manualmente
  Future<bool> checkConnectivity() async {
    final result = await _connectivity.checkConnectivity();
    _updateStatus(result);
    return _isOnline;
  }

  /// Dispose
  void dispose() {
    _subscription?.cancel();
    _connectivityController.close();
  }
}
```

---

## **PASSO 6: Motor de Sincronização Simplificado**

### 6.1 Sync Service (`lib/services/sync_service.dart`)

```dart
import 'dart:async';
import '../models/task.dart';
import '../models/sync_operation.dart';
import 'database_service.dart';
import 'api_service.dart';
import 'connectivity_service.dart';

/// Motor de Sincronização Offline-First
///
/// Implementa sincronização simples usando estratégia Last-Write-Wins (LWW)
class SyncService {
  final DatabaseService _db = DatabaseService.instance;
  final ApiService _api;
  final ConnectivityService _connectivity = ConnectivityService.instance;

  bool _isSyncing = false;
  Timer? _autoSyncTimer;

  final _syncStatusController = StreamController<SyncEvent>.broadcast();
  Stream<SyncEvent> get syncStatusStream => _syncStatusController.stream;

  SyncService({String userId = 'user1'}) : _api = ApiService(userId: userId);

  // ==================== SINCRONIZAÇÃO PRINCIPAL ====================

  /// Executar sincronização completa
  Future<SyncResult> sync() async {
    if (_isSyncing) {
      print('⏳ Sincronização já em andamento');
      return SyncResult(
        success: false,
        message: 'Sincronização já em andamento',
      );
    }

    if (!_connectivity.isOnline) {
      print('📴 Sem conectividade - operações enfileiradas');
      return SyncResult(
        success: false,
        message: 'Sem conexão com internet',
      );
    }

    _isSyncing = true;
    _notifyStatus(SyncEvent.syncStarted());

    try {
      print('🔄 Iniciando sincronização...');

      // 1. Push: Enviar operações pendentes
      final pushResult = await _pushPendingOperations();

      // 2. Pull: Buscar atualizações do servidor
      final pullResult = await _pullFromServer();

      // 3. Atualizar timestamp de última sync
      await _db.setMetadata(
        'lastSyncTimestamp',
        DateTime.now().millisecondsSinceEpoch.toString(),
      );

      print('✅ Sincronização concluída');
      _notifyStatus(SyncEvent.syncCompleted(
        pushedCount: pushResult,
        pulledCount: pullResult,
      ));

      return SyncResult(
        success: true,
        message: 'Sincronização concluída com sucesso',
        pushedOperations: pushResult,
        pulledTasks: pullResult,
      );

    } catch (e) {
      print('❌ Erro na sincronização: $e');
      _notifyStatus(SyncEvent.syncError(e.toString()));

      return SyncResult(
        success: false,
        message: 'Erro na sincronização: $e',
      );
    } finally {
      _isSyncing = false;
    }
  }

  // ==================== PUSH (Cliente → Servidor) ====================

  /// Enviar operações pendentes para o servidor
  Future<int> _pushPendingOperations() async {
    final operations = await _db.getPendingSyncOperations();
    print('📤 Enviando ${operations.length} operações pendentes');

    int successCount = 0;

    for (final operation in operations) {
      try {
        await _processOperation(operation);
        await _db.removeSyncOperation(operation.id);
        successCount++;
      } catch (e) {
        print('❌ Erro ao processar operação ${operation.id}: $e');

        // Incrementar tentativas
        await _db.updateSyncOperation(
          operation.copyWith(
            retries: operation.retries + 1,
            error: e.toString(),
          ),
        );

        // Se excedeu máximo de tentativas, marcar como failed
        if (operation.retries >= 3) {
          await _db.updateSyncOperation(
            operation.copyWith(status: SyncOperationStatus.failed),
          );
        }
      }
    }

    return successCount;
  }

  /// Processar operação individual
  Future<void> _processOperation(SyncOperation operation) async {
    switch (operation.type) {
      case OperationType.create:
        await _pushCreate(operation);
        break;
      case OperationType.update:
        await _pushUpdate(operation);
        break;
      case OperationType.delete:
        await _pushDelete(operation);
        break;
    }
  }

  Future<void> _pushCreate(SyncOperation operation) async {
    final task = await _db.getTask(operation.taskId);
    if (task == null) return;

    final serverTask = await _api.createTask(task);

    // Atualizar tarefa local com dados do servidor
    await _db.upsertTask(
      task.copyWith(
        version: serverTask.version,
        updatedAt: serverTask.updatedAt,
        syncStatus: SyncStatus.synced,
      ),
    );
  }

  Future<void> _pushUpdate(SyncOperation operation) async {
    final task = await _db.getTask(operation.taskId);
    if (task == null) return;

    final result = await _api.updateTask(task);

    if (result['conflict'] == true) {
      // Conflito detectado - aplicar Last-Write-Wins
      final serverTask = result['serverTask'] as Task;
      await _resolveConflict(task, serverTask);
    } else {
      // Sucesso - atualizar local
      final updatedTask = result['task'] as Task;
      await _db.upsertTask(
        task.copyWith(
          version: updatedTask.version,
          updatedAt: updatedTask.updatedAt,
          syncStatus: SyncStatus.synced,
        ),
      );
    }
  }

  Future<void> _pushDelete(SyncOperation operation) async {
    final task = await _db.getTask(operation.taskId);
    final version = task?.version ?? 1;

    await _api.deleteTask(operation.taskId, version);
    await _db.deleteTask(operation.taskId);
  }

  // ==================== PULL (Servidor → Cliente) ====================

  /// Buscar atualizações do servidor
  Future<int> _pullFromServer() async {
    final lastSyncStr = await _db.getMetadata('lastSyncTimestamp');
    final lastSync = lastSyncStr != null ? int.parse(lastSyncStr) : null;

    final result = await _api.getTasks(modifiedSince: lastSync);
    final serverTasks = result['tasks'] as List<Task>;

    print('📥 Recebidas ${serverTasks.length} tarefas do servidor');

    for (final serverTask in serverTasks) {
      final localTask = await _db.getTask(serverTask.id);

      if (localTask == null) {
        // Nova tarefa do servidor
        await _db.upsertTask(
          serverTask.copyWith(syncStatus: SyncStatus.synced),
        );
      } else if (localTask.syncStatus == SyncStatus.synced) {
        // Atualização do servidor (sem modificações locais)
        await _db.upsertTask(
          serverTask.copyWith(syncStatus: SyncStatus.synced),
        );
      } else {
        // Possível conflito - resolver
        await _resolveConflict(localTask, serverTask);
      }
    }

    return serverTasks.length;
  }

  // ==================== RESOLUÇÃO DE CONFLITOS (LWW) ====================

  /// Resolver conflito usando Last-Write-Wins
  Future<void> _resolveConflict(Task localTask, Task serverTask) async {
    print('⚠️ Conflito detectado: ${localTask.id}');

    final localTime = localTask.localUpdatedAt ?? localTask.updatedAt;
    final serverTime = serverTask.updatedAt;

    Task winningTask;
    String reason;

    if (localTime.isAfter(serverTime)) {
      // Versão local vence
      winningTask = localTask;
      reason = 'Modificação local é mais recente';
      print('🏆 LWW: Versão local vence');

      // Enviar versão local para servidor
      await _api.updateTask(localTask);
    } else {
      // Versão servidor vence
      winningTask = serverTask;
      reason = 'Modificação do servidor é mais recente';
      print('🏆 LWW: Versão servidor vence');
    }

    // Atualizar banco local com versão vencedora
    await _db.upsertTask(
      winningTask.copyWith(syncStatus: SyncStatus.synced),
    );

    _notifyStatus(SyncEvent.conflictResolved(
      taskId: localTask.id,
      resolution: reason,
    ));
  }

  // ==================== OPERAÇÕES COM FILA ====================

  /// Criar tarefa (com suporte offline)
  Future<Task> createTask(Task task) async {
    // Salvar localmente
    final savedTask = await _db.upsertTask(
      task.copyWith(
        syncStatus: SyncStatus.pending,
        localUpdatedAt: DateTime.now(),
      ),
    );

    // Adicionar à fila de sincronização
    await _db.addToSyncQueue(
      SyncOperation(
        type: OperationType.create,
        taskId: savedTask.id,
        data: savedTask.toMap(),
      ),
    );

    // Tentar sincronizar imediatamente se online
    if (_connectivity.isOnline) {
      sync();
    }

    return savedTask;
  }

  /// Atualizar tarefa (com suporte offline)
  Future<Task> updateTask(Task task) async {
    // Salvar localmente
    final updatedTask = await _db.upsertTask(
      task.copyWith(
        syncStatus: SyncStatus.pending,
        localUpdatedAt: DateTime.now(),
      ),
    );

    // Adicionar à fila de sincronização
    await _db.addToSyncQueue(
      SyncOperation(
        type: OperationType.update,
        taskId: updatedTask.id,
        data: updatedTask.toMap(),
      ),
    );

    // Tentar sincronizar imediatamente se online
    if (_connectivity.isOnline) {
      sync();
    }

    return updatedTask;
  }

  /// Deletar tarefa (com suporte offline)
  Future<void> deleteTask(String taskId) async {
    final task = await _db.getTask(taskId);
    if (task == null) return;

    // Adicionar à fila de sincronização antes de deletar
    await _db.addToSyncQueue(
      SyncOperation(
        type: OperationType.delete,
        taskId: taskId,
        data: {'version': task.version},
      ),
    );

    // Deletar localmente
    await _db.deleteTask(taskId);

    // Tentar sincronizar imediatamente se online
    if (_connectivity.isOnline) {
      sync();
    }
  }

  // ==================== SINCRONIZAÇÃO AUTOMÁTICA ====================

  /// Iniciar sincronização automática
  void startAutoSync({Duration interval = const Duration(seconds: 30)}) {
    stopAutoSync(); // Parar timer anterior se existir

    _autoSyncTimer = Timer.periodic(interval, (timer) {
      if (_connectivity.isOnline && !_isSyncing) {
        print('🔄 Auto-sync iniciado');
        sync();
      }
    });

    print('✅ Auto-sync configurado (intervalo: ${interval.inSeconds}s)');
  }

  /// Parar sincronização automática
  void stopAutoSync() {
    _autoSyncTimer?.cancel();
    _autoSyncTimer = null;
  }

  // ==================== NOTIFICAÇÕES ====================

  void _notifyStatus(SyncEvent event) {
    _syncStatusController.add(event);
  }

  // ==================== ESTATÍSTICAS ====================

  Future<SyncStats> getStats() async {
    final dbStats = await _db.getStats();
    final lastSyncStr = await _db.getMetadata('lastSyncTimestamp');
    final lastSync = lastSyncStr != null
        ? DateTime.fromMillisecondsSinceEpoch(int.parse(lastSyncStr))
        : null;

    return SyncStats(
      totalTasks: dbStats['totalTasks'],
      unsyncedTasks: dbStats['unsyncedTasks'],
      queuedOperations: dbStats['queuedOperations'],
      lastSync: lastSync,
      isOnline: _connectivity.isOnline,
      isSyncing: _isSyncing,
    );
  }

  // ==================== LIMPEZA ====================

  void dispose() {
    stopAutoSync();
    _syncStatusController.close();
  }
}

// ==================== MODELOS DE SUPORTE ====================

/// Resultado de sincronização
class SyncResult {
  final bool success;
  final String message;
  final int? pushedOperations;
  final int? pulledTasks;

  SyncResult({
    required this.success,
    required this.message,
    this.pushedOperations,
    this.pulledTasks,
  });
}

/// Evento de sincronização
class SyncEvent {
  final SyncEventType type;
  final String? message;
  final Map<String, dynamic>? data;

  SyncEvent({
    required this.type,
    this.message,
    this.data,
  });

  factory SyncEvent.syncStarted() => SyncEvent(type: SyncEventType.started);

  factory SyncEvent.syncCompleted({int? pushedCount, int? pulledCount}) =>
      SyncEvent(
        type: SyncEventType.completed,
        data: {'pushed': pushedCount, 'pulled': pulledCount},
      );

  factory SyncEvent.syncError(String error) => SyncEvent(
        type: SyncEventType.error,
        message: error,
      );

  factory SyncEvent.conflictResolved({
    required String taskId,
    required String resolution,
  }) =>
      SyncEvent(
        type: SyncEventType.conflictResolved,
        message: resolution,
        data: {'taskId': taskId},
      );
}

enum SyncEventType {
  started,
  completed,
  error,
  conflictResolved,
}

/// Estatísticas de sincronização
class SyncStats {
  final int totalTasks;
  final int unsyncedTasks;
  final int queuedOperations;
  final DateTime? lastSync;
  final bool isOnline;
  final bool isSyncing;

  SyncStats({
    required this.totalTasks,
    required this.unsyncedTasks,
    required this.queuedOperations,
    this.lastSync,
    required this.isOnline,
    required this.isSyncing,
  });
}
```

---

## **PASSO 7: Providers (State Management)**

### 7.1 Task Provider (`lib/providers/task_provider.dart`)

```dart
import 'package:flutter/foundation.dart';
import '../models/task.dart';
import '../services/database_service.dart';
import '../services/sync_service.dart';

/// Provider para gerenciamento de estado de tarefas
class TaskProvider with ChangeNotifier {
  final DatabaseService _db = DatabaseService.instance;
  final SyncService _syncService;

  List<Task> _tasks = [];
  bool _isLoading = false;
  String? _error;

  TaskProvider({String userId = 'user1'})
      : _syncService = SyncService(userId: userId);

  // Getters
  List<Task> get tasks => _tasks;
  bool get isLoading => _isLoading;
  String? get error => _error;

  List<Task> get completedTasks =>
      _tasks.where((task) => task.completed).toList();

  List<Task> get pendingTasks =>
      _tasks.where((task) => !task.completed).toList();

  List<Task> get unsyncedTasks =>
      _tasks.where((task) => task.syncStatus == SyncStatus.pending).toList();

  // ==================== INICIALIZAÇÃO ====================

  Future<void> initialize() async {
    await loadTasks();

    // Iniciar auto-sync
    _syncService.startAutoSync();

    // Escutar eventos de sincronização
    _syncService.syncStatusStream.listen((event) {
      if (event.type == SyncEventType.completed) {
        loadTasks(); // Recarregar tarefas após sync
      }
    });
  }

  // ==================== OPERAÇÕES DE TAREFAS ====================

  /// Carregar todas as tarefas
  Future<void> loadTasks() async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();

      _tasks = await _db.getAllTasks();

      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Criar nova tarefa
  Future<void> createTask({
    required String title,
    required String description,
    String priority = 'medium',
  }) async {
    try {
      final task = Task(
        title: title,
        description: description,
        priority: priority,
      );

      await _syncService.createTask(task);
      await loadTasks();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  /// Atualizar tarefa
  Future<void> updateTask(Task task) async {
    try {
      await _syncService.updateTask(task);
      await loadTasks();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  /// Alternar status de conclusão
  Future<void> toggleCompleted(Task task) async {
    await updateTask(task.copyWith(completed: !task.completed));
  }

  /// Deletar tarefa
  Future<void> deleteTask(String taskId) async {
    try {
      await _syncService.deleteTask(taskId);
      await loadTasks();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  // ==================== SINCRONIZAÇÃO ====================

  /// Sincronizar manualmente
  Future<SyncResult> sync() async {
    final result = await _syncService.sync();
    await loadTasks();
    return result;
  }

  /// Obter estatísticas de sincronização
  Future<SyncStats> getSyncStats() async {
    return await _syncService.getStats();
  }

  // ==================== LIMPEZA ====================

  @override
  void dispose() {
    _syncService.dispose();
    super.dispose();
  }
}
```

---

## **PASSO 8: Interface do Usuário**

### 8.1 Tela Principal (`lib/screens/home_screen.dart`)

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/task_provider.dart';
import '../models/task.dart';
import '../services/connectivity_service.dart';
import 'task_form_screen.dart';
import 'sync_status_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _connectivity = ConnectivityService.instance;
  bool _isOnline = true;

  @override
  void initState() {
    super.initState();
    _initializeConnectivity();
  }

  Future<void> _initializeConnectivity() async {
    await _connectivity.initialize();
    setState(() => _isOnline = _connectivity.isOnline);

    // Escutar mudanças de conectividade
    _connectivity.connectivityStream.listen((isOnline) {
      setState(() => _isOnline = isOnline);

      if (isOnline) {
        _showSnackBar('🟢 Conectado - Sincronizando...', Colors.green);
        context.read<TaskProvider>().sync();
      } else {
        _showSnackBar('🔴 Modo Offline', Colors.orange);
      }
    });
  }

  void _showSnackBar(String message, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: color,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tarefas Offline-First'),
        actions: [
          // Indicador de conectividade
          _buildConnectivityIndicator(),

          // Botão de sincronização manual
          IconButton(
            icon: const Icon(Icons.sync),
            onPressed: _isOnline ? _handleManualSync : null,
            tooltip: 'Sincronizar',
          ),

          // Botão de estatísticas
          IconButton(
            icon: const Icon(Icons.info_outline),
            onPressed: () => _navigateToSyncStatus(),
            tooltip: 'Status de Sincronização',
          ),
        ],
      ),
      body: Consumer<TaskProvider>(
        builder: (context, taskProvider, child) {
          if (taskProvider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (taskProvider.error != null) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 64, color: Colors.red),
                  const SizedBox(height: 16),
                  Text('Erro: ${taskProvider.error}'),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => taskProvider.loadTasks(),
                    child: const Text('Tentar Novamente'),
                  ),
                ],
              ),
            );
          }

          final tasks = taskProvider.tasks;

          if (tasks.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.inbox_outlined,
                    size: 64,
                    color: Colors.grey[400],
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Nenhuma tarefa',
                    style: TextStyle(
                      fontSize: 18,
                      color: Colors.grey[600],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Toque em + para criar',
                    style: TextStyle(color: Colors.grey[500]),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () => taskProvider.sync(),
            child: ListView.builder(
              itemCount: tasks.length,
              padding: const EdgeInsets.all(8),
              itemBuilder: (context, index) {
                final task = tasks[index];
                return _buildTaskCard(task, taskProvider);
              },
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _navigateToTaskForm,
        child: const Icon(Icons.add),
        tooltip: 'Nova Tarefa',
      ),
    );
  }

  Widget _buildConnectivityIndicator() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Center(
        child: Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: _isOnline ? Colors.green : Colors.red,
          ),
        ),
      ),
    );
  }

  Widget _buildTaskCard(Task task, TaskProvider provider) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
      child: ListTile(
        leading: Checkbox(
          value: task.completed,
          onChanged: (_) => provider.toggleCompleted(task),
        ),
        title: Text(
          task.title,
          style: TextStyle(
            decoration: task.completed ? TextDecoration.lineThrough : null,
          ),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (task.description.isNotEmpty)
              Text(
                task.description,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            const SizedBox(height: 4),
            Row(
              children: [
                _buildPriorityBadge(task.priority),
                const SizedBox(width: 8),
                _buildSyncStatusBadge(task.syncStatus),
              ],
            ),
          ],
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              icon: const Icon(Icons.edit),
              onPressed: () => _navigateToTaskForm(task: task),
            ),
            IconButton(
              icon: const Icon(Icons.delete),
              onPressed: () => _confirmDelete(task, provider),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPriorityBadge(String priority) {
    Color color;
    switch (priority) {
      case 'urgent':
        color = Colors.red;
        break;
      case 'high':
        color = Colors.orange;
        break;
      case 'medium':
        color = Colors.blue;
        break;
      case 'low':
        color = Colors.green;
        break;
      default:
        color = Colors.grey;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.2),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color),
      ),
      child: Text(
        priority.toUpperCase(),
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.bold,
          color: color,
        ),
      ),
    );
  }

  Widget _buildSyncStatusBadge(SyncStatus status) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: _getSyncStatusColor(status).withOpacity(0.2),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        status.icon,
        style: const TextStyle(fontSize: 10),
      ),
    );
  }

  Color _getSyncStatusColor(SyncStatus status) {
    switch (status) {
      case SyncStatus.synced:
        return Colors.green;
      case SyncStatus.pending:
        return Colors.orange;
      case SyncStatus.conflict:
        return Colors.red;
      case SyncStatus.error:
        return Colors.red;
    }
  }

  Future<void> _handleManualSync() async {
    final provider = context.read<TaskProvider>();

    _showSnackBar('🔄 Sincronizando...', Colors.blue);

    final result = await provider.sync();

    if (result.success) {
      _showSnackBar(
        '✅ Sincronização concluída',
        Colors.green,
      );
    } else {
      _showSnackBar(
        '❌ Erro na sincronização',
        Colors.red,
      );
    }
  }

  void _navigateToTaskForm({Task? task}) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => TaskFormScreen(task: task),
      ),
    );
  }

  void _navigateToSyncStatus() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => const SyncStatusScreen(),
      ),
    );
  }

  Future<void> _confirmDelete(Task task, TaskProvider provider) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirmar exclusão'),
        content: Text('Deseja deletar "${task.title}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Deletar'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await provider.deleteTask(task.id);
      if (mounted) {
        _showSnackBar('🗑️ Tarefa deletada', Colors.grey);
      }
    }
  }
}
```

### 8.2 Formulário de Tarefa (`lib/screens/task_form_screen.dart`)

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/task.dart';
import '../providers/task_provider.dart';

class TaskFormScreen extends StatefulWidget {
  final Task? task;

  const TaskFormScreen({super.key, this.task});

  @override
  State<TaskFormScreen> createState() => _TaskFormScreenState();
}

class _TaskFormScreenState extends State<TaskFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _titleController;
  late TextEditingController _descriptionController;
  late String _priority;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController(text: widget.task?.title ?? '');
    _descriptionController = TextEditingController(
      text: widget.task?.description ?? '',
    );
    _priority = widget.task?.priority ?? 'medium';
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isEditing = widget.task != null;

    return Scaffold(
      appBar: AppBar(
        title: Text(isEditing ? 'Editar Tarefa' : 'Nova Tarefa'),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _titleController,
              decoration: const InputDecoration(
                labelText: 'Título',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.title),
              ),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Título é obrigatório';
                }
                return null;
              },
              textCapitalization: TextCapitalization.sentences,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _descriptionController,
              decoration: const InputDecoration(
                labelText: 'Descrição',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.description),
              ),
              maxLines: 4,
              textCapitalization: TextCapitalization.sentences,
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _priority,
              decoration: const InputDecoration(
                labelText: 'Prioridade',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.flag),
              ),
              items: const [
                DropdownMenuItem(value: 'low', child: Text('Baixa')),
                DropdownMenuItem(value: 'medium', child: Text('Média')),
                DropdownMenuItem(value: 'high', child: Text('Alta')),
                DropdownMenuItem(value: 'urgent', child: Text('Urgente')),
              ],
              onChanged: (value) {
                if (value != null) {
                  setState(() => _priority = value);
                }
              },
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _isLoading ? null : _handleSubmit,
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: _isLoading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(isEditing ? 'Salvar Alterações' : 'Criar Tarefa'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      final provider = context.read<TaskProvider>();

      if (widget.task != null) {
        // Atualizar tarefa existente
        await provider.updateTask(
          widget.task!.copyWith(
            title: _titleController.text.trim(),
            description: _descriptionController.text.trim(),
            priority: _priority,
          ),
        );
      } else {
        // Criar nova tarefa
        await provider.createTask(
          title: _titleController.text.trim(),
          description: _descriptionController.text.trim(),
          priority: _priority,
        );
      }

      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              widget.task != null
                  ? '✅ Tarefa atualizada'
                  : '✅ Tarefa criada',
            ),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('❌ Erro: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }
}
```

### 8.3 Tela de Status de Sincronização (`lib/screens/sync_status_screen.dart`)

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/task_provider.dart';
import '../services/sync_service.dart';

class SyncStatusScreen extends StatelessWidget {
  const SyncStatusScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Status de Sincronização'),
      ),
      body: Consumer<TaskProvider>(
        builder: (context, provider, child) {
          return FutureBuilder<SyncStats>(
            future: provider.getSyncStats(),
            builder: (context, snapshot) {
              if (!snapshot.hasData) {
                return const Center(child: CircularProgressIndicator());
              }

              final stats = snapshot.data!;

              return ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _buildStatusCard(
                    title: 'Conectividade',
                    icon: Icons.wifi,
                    value: stats.isOnline ? 'Online' : 'Offline',
                    color: stats.isOnline ? Colors.green : Colors.red,
                  ),
                  _buildStatusCard(
                    title: 'Status de Sincronização',
                    icon: Icons.sync,
                    value: stats.isSyncing ? 'Sincronizando...' : 'Ocioso',
                    color: stats.isSyncing ? Colors.blue : Colors.grey,
                  ),
                  _buildStatusCard(
                    title: 'Total de Tarefas',
                    icon: Icons.task,
                    value: '${stats.totalTasks}',
                    color: Colors.blue,
                  ),
                  _buildStatusCard(
                    title: 'Tarefas Não Sincronizadas',
                    icon: Icons.cloud_off,
                    value: '${stats.unsyncedTasks}',
                    color: stats.unsyncedTasks > 0 ? Colors.orange : Colors.green,
                  ),
                  _buildStatusCard(
                    title: 'Operações na Fila',
                    icon: Icons.queue,
                    value: '${stats.queuedOperations}',
                    color: stats.queuedOperations > 0 ? Colors.orange : Colors.green,
                  ),
                  _buildStatusCard(
                    title: 'Última Sincronização',
                    icon: Icons.update,
                    value: stats.lastSync != null
                        ? DateFormat('dd/MM/yyyy HH:mm').format(stats.lastSync!)
                        : 'Nunca',
                    color: Colors.grey,
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton.icon(
                    onPressed: stats.isOnline && !stats.isSyncing
                        ? () => _handleSync(context, provider)
                        : null,
                    icon: const Icon(Icons.sync),
                    label: const Text('Sincronizar Agora'),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                  ),
                ],
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildStatusCard({
    required String title,
    required IconData icon,
    required String value,
    required Color color,
  }) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 14,
                      color: Colors.grey,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    value,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _handleSync(BuildContext context, TaskProvider provider) async {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('🔄 Iniciando sincronização...'),
        duration: Duration(seconds: 1),
      ),
    );

    final result = await provider.sync();

    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result.success
                ? '✅ Sincronização concluída'
                : '❌ ${result.message}',
          ),
          backgroundColor: result.success ? Colors.green : Colors.red,
        ),
      );
    }
  }
}
```

---

## **PASSO 9: Aplicação Principal**

### 9.1 Main (`lib/main.dart`)

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/task_provider.dart';
import 'screens/home_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => TaskProvider()..initialize(),
      child: MaterialApp(
        title: 'Task Manager Offline-First',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
          useMaterial3: true,
          cardTheme: CardTheme(
            elevation: 2,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
        home: const HomeScreen(),
      ),
    );
  }
}
```

---

## **PASSO 10: Script de Demonstração e Testes**

### 10.1 Roteiro de Demonstração

Crie um arquivo `DEMONSTRACAO.md`:

```markdown
# Roteiro de Demonstração - Offline-First

## Pré-requisitos
1. Servidor backend rodando: `cd server && node server.js`
2. App Flutter instalado no dispositivo/emulador

## Cenário 1: Criação Offline
**Objetivo**: Demonstrar criação de tarefas sem conexão

1. ✅ Desabilitar WiFi/dados no dispositivo
2. ✅ Abrir o app (indicador vermelho deve aparecer)
3. ✅ Criar nova tarefa: "Comprar leite"
4. ✅ Observar badge "⏱" (pendente)
5. ✅ Reabilitar conexão
6. ✅ App sincroniza automaticamente
7. ✅ Badge muda para "✓" (sincronizada)

**Resultado esperado**: Tarefa criada localmente e sincronizada ao voltar online

## Cenário 2: Edição com Conflito (LWW)
**Objetivo**: Demonstrar resolução de conflito Last-Write-Wins

### Parte A: Configurar cenário de conflito
1. ✅ Com conexão online, criar tarefa: "Revisar código"
2. ✅ Aguardar sincronização
3. ✅ Desabilitar conexão
4. ✅ Editar tarefa localmente: "Revisar código - Frontend"
5. ✅ No servidor (via Postman/cURL), editar mesma tarefa: "Revisar código - Backend"

### Parte B: Sincronizar e observar conflito
6. ✅ Reabilitar conexão
7. ✅ App sincroniza automaticamente
8. ✅ Console mostra: "⚠️ Conflito detectado"
9. ✅ Versão mais recente vence (LWW)
10. ✅ Tarefa atualizada com versão vencedora

**Resultado esperado**: Conflito resolvido automaticamente usando timestamp

## Cenário 3: Fila de Operações
**Objetivo**: Demonstrar enfileiramento de múltiplas operações

1. ✅ Desabilitar conexão
2. ✅ Criar 3 tarefas: "A", "B", "C"
3. ✅ Editar tarefa "A"
4. ✅ Deletar tarefa "B"
5. ✅ Abrir tela de Status de Sincronização
6. ✅ Observar "5 operações na fila"
7. ✅ Reabilitar conexão
8. ✅ Sincronização processa todas operações em ordem
9. ✅ Fila limpa após sucesso

**Resultado esperado**: Todas operações processadas corretamente

## Cenário 4: Indicadores Visuais
**Objetivo**: Validar UX de sincronização

1. ✅ Indicador de conectividade (bolinha verde/vermelha)
2. ✅ Badges de status em cada tarefa
3. ✅ Botão de sincronização manual
4. ✅ RefreshIndicator (pull-to-refresh)
5. ✅ SnackBars informativos

## Verificação de Persistência
**Objetivo**: Garantir dados persistem após fechar app

1. ✅ Criar tarefas offline
2. ✅ Fechar app completamente
3. ✅ Reabrir app (sem conexão)
4. ✅ Tarefas ainda visíveis
5. ✅ Conectar e sincronizar

**Resultado esperado**: Dados persistidos localmente
```

---

## **PASSO 11: Análise Comparativa e Entregáveis**

### 11.1 Tabela Comparativa

Crie um arquivo `ANALISE_COMPARATIVA.md`:

```markdown
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

## Casos de Uso Recomendados

### Offline-First é Ideal Para:
✅ Aplicações móveis em áreas com conectividade instável
✅ Apps que precisam funcionar sempre (saúde, logística)
✅ Cenários onde latência percebida é crítica
✅ Apps com uso intensivo de dados locais

### REST é Melhor Para:
✅ APIs públicas web
✅ Sistemas com conectividade confiável
✅ CRUD simples sem requisitos offline
✅ Prototipagem rápida

### gRPC é Melhor Para:
✅ Comunicação entre microsserviços
✅ APIs internas de alta performance
✅ Streaming de dados em tempo real
✅ Sistemas distribuídos complexos

## Trade-offs do Offline-First

### Vantagens
✅ **UX Superior**: App sempre responsivo
✅ **Economia de Dados**: Sincroniza apenas mudanças
✅ **Maior Disponibilidade**: Funciona sem rede
✅ **Menor Latência**: Operações instantâneas

### Desvantagens
❌ **Complexidade**: Muito mais código para manter
❌ **Conflitos**: Necessita estratégias de resolução
❌ **Consistência Eventual**: Dados podem divergir temporariamente
❌ **Armazenamento Local**: Consome espaço no dispositivo
❌ **Debugging Difícil**: Mais pontos de falha

## Conclusão

O paradigma Offline-First oferece a **melhor experiência do usuário**
ao custo de **maior complexidade de implementação**.

**Recomendação**: Use Offline-First quando a **disponibilidade** e
**experiência do usuário** são mais importantes que a
**simplicidade de implementação**.
```

---

## **Comandos de Execução**

```bash
# 1. Iniciar servidor backend
cd server
npm install
npm start
# Servidor em http://localhost:3000

# 2. Executar app Flutter
cd ..
flutter pub get
flutter run

# 3. Testar conectividade (Android)
# Desabilitar WiFi: Settings > Network > WiFi OFF
# Habilitar WiFi: Settings > Network > WiFi ON

# 4. Limpar dados (reset)
flutter clean
flutter pub get
```

---

## **Referências**

<sup>[1]</sup> **KLEPPMANN, Martin.** Designing Data-Intensive Applications. O'Reilly Media, 2017.

<sup>[2]</sup> **TANENBAUM, Andrew S.; VAN STEEN, Maarten.** Distributed Systems: Principles and Paradigms. 3rd ed. Boston: Pearson, 2017.

<sup>[3]</sup> **VOGELS, Werner.** Eventually Consistent. Communications of the ACM, vol. 52, no. 1, 2009.

<sup>[4]</sup> **FLUTTER DOCUMENTATION.** Working with SQLite. Disponível em: <https://docs.flutter.dev/cookbook/persistence/sqlite>

import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

import '../models/sync_operation.dart';
import '../models/task.dart';

/// Serviço de gerenciamento do banco de dados SQLite local (modo offline-first)
class OfflineDatabaseService {
  OfflineDatabaseService._();

  static final OfflineDatabaseService instance = OfflineDatabaseService._();
  static Database? _database;

  static const _dbName = 'task_manager_offline.db';
  static const _dbVersion = 1;

  Future<Database> get database async {
    if (_database != null) {
      return _database!;
    }
    _database = await _initDB(_dbName);
    return _database!;
  }

  Future<Database> _initDB(String filePath) async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, filePath);

    return openDatabase(
      path,
      version: _dbVersion,
      onCreate: _createDB,
    );
  }

  Future<void> _createDB(Database db, int version) async {
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

    await db.execute('''
      CREATE TABLE metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    ''');

    await db.execute('CREATE INDEX idx_tasks_userId ON tasks(userId)');
    await db.execute('CREATE INDEX idx_tasks_syncStatus ON tasks(syncStatus)');
    await db
        .execute('CREATE INDEX idx_sync_queue_status ON sync_queue(status)');
  }

  // ==================== OPERAÇÕES DE TAREFAS ====================

  Future<Task> upsertTask(Task task) async {
    final db = await database;
    await db.insert(
      'tasks',
      task.toMap(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
    return task;
  }

  Future<Task?> getTask(String id) async {
    final db = await database;
    final maps = await db.query(
      'tasks',
      where: 'id = ?',
      whereArgs: [id],
    );

    if (maps.isEmpty) {
      return null;
    }
    return Task.fromMap(maps.first);
  }

  Future<List<Task>> getAllTasks({String userId = 'user1'}) async {
    final db = await database;
    final maps = await db.query(
      'tasks',
      where: 'userId = ?',
      whereArgs: [userId],
      orderBy: 'updatedAt DESC',
    );
    return maps.map(Task.fromMap).toList();
  }

  Future<List<Task>> getUnsyncedTasks() async {
    final db = await database;
    final maps = await db.query(
      'tasks',
      where: 'syncStatus = ?',
      whereArgs: [SyncStatus.pending.name],
    );
    return maps.map(Task.fromMap).toList();
  }

  Future<List<Task>> getConflictedTasks() async {
    final db = await database;
    final maps = await db.query(
      'tasks',
      where: 'syncStatus = ?',
      whereArgs: [SyncStatus.conflict.name],
    );
    return maps.map(Task.fromMap).toList();
  }

  Future<int> deleteTask(String id) async {
    final db = await database;
    return db.delete('tasks', where: 'id = ?', whereArgs: [id]);
  }

  Future<void> updateSyncStatus(String id, SyncStatus status) async {
    final db = await database;
    await db.update(
      'tasks',
      {
        'syncStatus': status.name,
        'localUpdatedAt': null,
        'updatedAt': DateTime.now().millisecondsSinceEpoch,
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  // ==================== FILA DE SINCRONIZAÇÃO ====================

  Future<SyncOperation> addToSyncQueue(SyncOperation operation) async {
    final db = await database;
    await db.insert(
      'sync_queue',
      operation.toMap(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
    return operation;
  }

  Future<List<SyncOperation>> getPendingSyncOperations() async {
    final db = await database;
    final maps = await db.query(
      'sync_queue',
      where: 'status = ?',
      whereArgs: [SyncOperationStatus.pending.name],
      orderBy: 'timestamp ASC',
    );
    return maps.map(SyncOperation.fromMap).toList();
  }

  Future<void> updateSyncOperation(SyncOperation operation) async {
    final db = await database;
    await db.update(
      'sync_queue',
      operation.toMap(),
      where: 'id = ?',
      whereArgs: [operation.id],
    );
  }

  Future<int> removeSyncOperation(String id) async {
    final db = await database;
    return db.delete(
      'sync_queue',
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  Future<int> clearCompletedOperations() async {
    final db = await database;
    return db.delete(
      'sync_queue',
      where: 'status = ?',
      whereArgs: [SyncOperationStatus.completed.name],
    );
  }

  // ==================== METADADOS ====================

  Future<void> setMetadata(String key, String value) async {
    final db = await database;
    await db.insert(
      'metadata',
      {'key': key, 'value': value},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<String?> getMetadata(String key) async {
    final db = await database;
    final maps = await db.query(
      'metadata',
      where: 'key = ?',
      whereArgs: [key],
    );
    if (maps.isEmpty) {
      return null;
    }
    return maps.first['value'] as String;
  }

  // ==================== ESTATÍSTICAS ====================

  Future<Map<String, dynamic>> getStats() async {
    final db = await database;

    final totalTasks = Sqflite.firstIntValue(
          await db.rawQuery('SELECT COUNT(*) FROM tasks'),
        ) ??
        0;

    final unsyncedTasks = Sqflite.firstIntValue(
          await db.rawQuery(
            'SELECT COUNT(*) FROM tasks WHERE syncStatus = ?',
            [SyncStatus.pending.name],
          ),
        ) ??
        0;

    final queuedOperations = Sqflite.firstIntValue(
          await db.rawQuery(
            'SELECT COUNT(*) FROM sync_queue WHERE status = ?',
            [SyncOperationStatus.pending.name],
          ),
        ) ??
        0;

    final lastSync = await getMetadata('lastSyncTimestamp');

    return {
      'totalTasks': totalTasks,
      'unsyncedTasks': unsyncedTasks,
      'queuedOperations': queuedOperations,
      'lastSync': lastSync != null ? int.tryParse(lastSync) : null,
    };
  }

  // ==================== UTILIDADES ====================

  Future<void> clearAllData() async {
    final db = await database;
    await db.delete('tasks');
    await db.delete('sync_queue');
    await db.delete('metadata');
  }

  Future<void> close() async {
    final db = await database;
    await db.close();
    _database = null;
  }
}

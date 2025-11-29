import 'dart:async';

import 'package:flutter/foundation.dart';

import '../config.dart';
import '../models/sync_operation.dart';
import '../models/task.dart';
import 'api_service.dart';
import 'connectivity_service.dart';
import 'database_service.dart';

/// Motor de sincronização Offline-First
class SyncService {
  SyncService({String userId = 'user1'})
      : _api = ApiService(userId: userId),
        _userId = userId {
    // Se ocorrer conectividade, tentar sincronizar imediatamente.
    try {
      _connectivitySub = _connectivity.connectivityStream.listen((online) {
        if (online && !_isSyncing) {
          if (kDebugMode)
            debugPrint('Connectivity changed: online -> starting sync');
          // não esperar o término aqui
          unawaited(sync());
        }
      });
    } catch (_) {
      // ignore - caso o serviço de conectividade não esteja inicializado ainda
    }
  }

  final OfflineDatabaseService _db = OfflineDatabaseService.instance;
  final ApiService _api;
  final ConnectivityService _connectivity = ConnectivityService.instance;
  final String _userId;

  StreamSubscription<bool>? _connectivitySub;

  bool _isSyncing = false;
  Timer? _autoSyncTimer;

  final _syncStatusController = StreamController<SyncEvent>.broadcast();
  Stream<SyncEvent> get syncStatusStream => _syncStatusController.stream;

  Future<SyncResult> sync() async {
    if (_isSyncing) {
      return SyncResult(
        success: false,
        message: 'Sincronização já em andamento',
      );
    }

    if (!_connectivity.isOnline) {
      return SyncResult(
        success: false,
        message: 'Sem conexão com internet',
      );
    }

    // Verifica se o servidor está acessível antes de iniciar operações que possam timeout.
    try {
      // Em modo de desenvolvimento é possível pular o health-check para forçar
      // a sincronização local sem depender da verificação /health do servidor.
      if (!AppConfig.devSkipHealthCheck) {
        final serverOk = await _api.checkConnectivity();
        if (!serverOk) {
          return SyncResult(
            success: false,
            message: 'Servidor inacessível (health check falhou)',
          );
        }
      } else {
        if (kDebugMode)
          debugPrint(
              'AppConfig.devSkipHealthCheck=true — pulando health-check');
      }
    } catch (e) {
      return SyncResult(
        success: false,
        message: 'Erro ao verificar servidor: $e',
      );
    }

    _isSyncing = true;
    _notifyStatus(SyncEvent.syncStarted());

    try {
      final pushed = await _pushPendingOperations();
      final pulled = await _pullFromServer();

      await _db.setMetadata(
        'lastSyncTimestamp',
        DateTime.now().millisecondsSinceEpoch.toString(),
      );

      final result = SyncResult(
        success: true,
        message: 'Sincronização concluída',
        pushedOperations: pushed,
        pulledTasks: pulled,
      );

      _notifyStatus(
        SyncEvent.syncCompleted(
          pushedCount: pushed,
          pulledCount: pulled,
        ),
      );

      return result;
    } catch (error) {
      final result = SyncResult(
        success: false,
        message: 'Erro na sincronização: $error',
      );
      _notifyStatus(SyncEvent.syncError(result.message));
      return result;
    } finally {
      _isSyncing = false;
    }
  }

  Future<int> _pushPendingOperations() async {
    final operations = await _db.getPendingSyncOperations();
    var successCount = 0;

    for (final operation in operations) {
      if (kDebugMode) {
        debugPrint(
            'SYNC: processing operation id=${operation.id} type=${operation.type} task=${operation.taskId} retries=${operation.retries}');
      }

      try {
        await _processOperation(operation);
        await _db.removeSyncOperation(operation.id);
        successCount += 1;
      } catch (error) {
        // Construir mensagem de erro detalhada, preferindo detalhes HTTP quando disponíveis
        String errorMsg = error.toString();
        try {
          if (error is ApiException) {
            final body = (error.body ?? '').toString();
            final truncatedBody = body.length > 1000
                ? '${body.substring(0, 1000)}...<truncated>'
                : body;
            errorMsg =
                'HTTP ${error.statusCode}: ${error.message}; body=${truncatedBody}';
          }
        } catch (_) {
          // ignore parsing error
        }

        if (kDebugMode) {
          debugPrint(
              'SYNC ERROR: operação ${operation.id} tipo=${operation.type} task=${operation.taskId} erro=$errorMsg');
        }

        final retries = operation.retries + 1;
        final status = retries >= 3
            ? SyncOperationStatus.failed
            : SyncOperationStatus.pending;
        await _db.updateSyncOperation(
          operation.copyWith(
            retries: retries,
            status: status,
            error: errorMsg,
          ),
        );
      }
    }

    return successCount;
  }

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
    if (task == null) {
      return;
    }

    final serverTask = await _api.createTask(task);
    await _db.upsertTask(
      task.copyWith(
        version: serverTask.version,
        syncStatus: SyncStatus.synced,
        localUpdatedAt: null,
        updatedAt: serverTask.updatedAt,
        lastSynced: DateTime.now(),
      ),
    );
  }

  Future<void> _pushUpdate(SyncOperation operation) async {
    final task = await _db.getTask(operation.taskId);
    if (task == null) {
      return;
    }

    final result = await _api.updateTask(task);

    if (result['conflict'] == true) {
      final serverTask = result['serverTask'] as Task;
      await _resolveConflict(task, serverTask);
    } else {
      final updatedTask = result['task'] as Task;
      await _db.upsertTask(
        task.copyWith(
          version: updatedTask.version,
          syncStatus: SyncStatus.synced,
          updatedAt: updatedTask.updatedAt,
          localUpdatedAt: null,
          lastSynced: DateTime.now(),
        ),
      );
    }
  }

  Future<void> _pushDelete(SyncOperation operation) async {
    final task = await _db.getTask(operation.taskId);
    final version = task?.version ?? 1;

    final success = await _api.deleteTask(operation.taskId, version);
    if (success) {
      await _db.deleteTask(operation.taskId);
    }
  }

  Future<int> _pullFromServer() async {
    final lastSyncStr = await _db.getMetadata('lastSyncTimestamp');
    final lastSync = lastSyncStr != null ? int.tryParse(lastSyncStr) : null;

    final result = await _api.getTasks(modifiedSince: lastSync);
    final tasks = result['tasks'] as List<Task>;

    for (final serverTask in tasks) {
      final localTask = await _db.getTask(serverTask.id);
      if (localTask == null) {
        await _db.upsertTask(
          serverTask.copyWith(
            syncStatus: SyncStatus.synced,
            lastSynced: DateTime.now(),
          ),
        );
      } else if (localTask.syncStatus == SyncStatus.synced) {
        await _db.upsertTask(
          serverTask.copyWith(
            syncStatus: SyncStatus.synced,
          ),
        );
      } else {
        await _resolveConflict(localTask, serverTask);
      }
    }

    return tasks.length;
  }

  Future<void> _resolveConflict(Task localTask, Task serverTask) async {
    final localTime = localTask.localUpdatedAt ?? localTask.updatedAt;
    final serverTime = serverTask.updatedAt;

    Task winner;
    String reason;

    if (localTime.isAfter(serverTime)) {
      winner = localTask;
      reason = 'Modificação local é mais recente';
      await _api.updateTask(localTask);
    } else {
      winner = serverTask;
      reason = 'Modificação do servidor é mais recente';
    }

    await _db.upsertTask(
      winner.copyWith(
        syncStatus: SyncStatus.synced,
        localUpdatedAt: null,
        lastSynced: DateTime.now(),
      ),
    );

    _notifyStatus(
      SyncEvent.conflictResolved(
        taskId: localTask.id,
        resolution: reason,
      ),
    );
  }

  Future<Task> createTask(Task task) async {
    try {
      final now = DateTime.now();
      final saved = await _db.upsertTask(
        task.copyWith(
          syncStatus: SyncStatus.pending,
          localUpdatedAt: now,
          updatedAt: now,
          userId: _userId,
        ),
      );

      await _db.addToSyncQueue(
        SyncOperation(
          type: OperationType.create,
          taskId: saved.id,
          data: saved.toJson(),
        ),
      );

      if (_connectivity.isOnline) {
        // Fire-and-forget sync; avoid bringing new dependency just for `unawaited`.
        // ignore: unawaited_futures
        sync();
      }

      return saved;
    } catch (e, st) {
      if (kDebugMode) {
        debugPrint('SyncService.createTask error: $e');
        debugPrintStack(stackTrace: st);
      }
      rethrow;
    }
  }

  Future<Task> updateTask(Task task) async {
    final now = DateTime.now();
    final updated = await _db.upsertTask(
      task.copyWith(
        syncStatus: SyncStatus.pending,
        localUpdatedAt: now,
        updatedAt: now,
        userId: _userId,
      ),
    );

    await _db.addToSyncQueue(
      SyncOperation(
        type: OperationType.update,
        taskId: updated.id,
        data: updated.toJson(),
      ),
    );

    if (_connectivity.isOnline) {
      unawaited(sync());
    }

    return updated;
  }

  Future<void> deleteTask(String taskId) async {
    final task = await _db.getTask(taskId);
    if (task == null) {
      return;
    }

    await _db.addToSyncQueue(
      SyncOperation(
        type: OperationType.delete,
        taskId: taskId,
        data: {
          'version': task.version,
        },
      ),
    );

    await _db.deleteTask(taskId);

    if (_connectivity.isOnline) {
      unawaited(sync());
    }
  }

  void startAutoSync({Duration interval = const Duration(seconds: 30)}) {
    stopAutoSync();
    _autoSyncTimer = Timer.periodic(interval, (timer) {
      if (_connectivity.isOnline && !_isSyncing) {
        unawaited(sync());
      }
    });
  }

  void stopAutoSync() {
    _autoSyncTimer?.cancel();
    _autoSyncTimer = null;
  }

  Future<SyncStats> getStats() async {
    final dbStats = await _db.getStats();
    final lastSyncStr = await _db.getMetadata('lastSyncTimestamp');

    return SyncStats(
      totalTasks: dbStats['totalTasks'] as int,
      unsyncedTasks: dbStats['unsyncedTasks'] as int,
      queuedOperations: dbStats['queuedOperations'] as int,
      lastSync: lastSyncStr != null
          ? DateTime.fromMillisecondsSinceEpoch(int.parse(lastSyncStr))
          : null,
      isOnline: _connectivity.isOnline,
      isSyncing: _isSyncing,
    );
  }

  void dispose() {
    stopAutoSync();
    _connectivitySub?.cancel();
    _syncStatusController.close();
  }

  void _notifyStatus(SyncEvent event) {
    if (!_syncStatusController.isClosed) {
      _syncStatusController.add(event);
    }
  }
}

class SyncResult {
  SyncResult({
    required this.success,
    required this.message,
    this.pushedOperations,
    this.pulledTasks,
  });

  final bool success;
  final String message;
  final int? pushedOperations;
  final int? pulledTasks;
}

class SyncEvent {
  SyncEvent({
    required this.type,
    this.message,
    this.data,
  });

  final SyncEventType type;
  final String? message;
  final Map<String, dynamic>? data;

  factory SyncEvent.syncStarted() => SyncEvent(type: SyncEventType.started);

  factory SyncEvent.syncCompleted({int? pushedCount, int? pulledCount}) =>
      SyncEvent(
        type: SyncEventType.completed,
        data: {
          'pushed': pushedCount,
          'pulled': pulledCount,
        },
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
        data: {
          'taskId': taskId,
        },
      );
}

enum SyncEventType {
  started,
  completed,
  error,
  conflictResolved,
}

class SyncStats {
  SyncStats({
    required this.totalTasks,
    required this.unsyncedTasks,
    required this.queuedOperations,
    required this.isOnline,
    required this.isSyncing,
    this.lastSync,
  });

  final int totalTasks;
  final int unsyncedTasks;
  final int queuedOperations;
  final bool isOnline;
  final bool isSyncing;
  final DateTime? lastSync;
}

import 'package:flutter/foundation.dart';

import '../../services/camera_service.dart';
import '../models/sync_operation.dart';
import '../models/task.dart';
import '../services/connectivity_service.dart';
import '../services/database_service.dart';
import '../services/sync_service.dart';

/// Provider para gerenciamento de estado das tarefas no modo offline-first
class TaskProvider with ChangeNotifier {
  TaskProvider({String userId = 'user1'})
      : _syncService = SyncService(userId: userId),
        _userId = userId;

  final OfflineDatabaseService _db = OfflineDatabaseService.instance;
  final SyncService _syncService;
  final String _userId;

  List<Task> _tasks = <Task>[];
  bool _isLoading = false;
  String? _error;

  List<Task> get tasks => _tasks;
  bool get isLoading => _isLoading;
  String? get error => _error;

  List<Task> get completedTasks =>
      _tasks.where((task) => task.completed).toList(growable: false);

  List<Task> get pendingTasks =>
      _tasks.where((task) => !task.completed).toList(growable: false);

  List<Task> get unsyncedTasks => _tasks
      .where((task) => task.syncStatus == SyncStatus.pending)
      .toList(growable: false);

  Future<void> initialize() async {
    _syncService.startAutoSync();

    // Inicializa recursos nativos opcionais (câmera / localização)
    try {
      await CameraService.instance.initialize();
    } catch (_) {}

    try {
      // não forçamos permissão aqui — apenas inicializamos o helper
      // permissões são solicitadas quando necessário na UI
      // (LocationService tem métodos para checar/solicitar permissão).
      // nada a fazer aqui além de garantir que o singleton esteja pronto.
    } catch (_) {}

    await loadTasks();

    // Atualiza tarefas quando a sincronização termina ou encontra erro/conflict.
    _syncService.syncStatusStream.listen((event) {
      if (event.type == SyncEventType.completed ||
          event.type == SyncEventType.error ||
          event.type == SyncEventType.conflictResolved) {
        loadTasks();
      }
    });
  }

  /// Limpa toda a fila de sincronização (reset)
  Future<void> clearSyncQueue() async {
    try {
      await _db.clearSyncQueue();
      await loadTasks();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  /// Re-enfileira todas as tarefas com `syncStatus == error` como operações de update
  Future<void> retryAll() async {
    try {
      final errorTasks = await _db.getErrorTasks();
      for (final t in errorTasks) {
        final now = DateTime.now();
        final updated = t.copyWith(
          syncStatus: SyncStatus.pending,
          localUpdatedAt: now,
          updatedAt: now,
        );
        await _db.upsertTask(updated);
        await _db.addToSyncQueue(
          SyncOperation(
            type: OperationType.update,
            taskId: updated.id,
            data: updated.toJson(),
          ),
        );
      }

      await loadTasks();
      // Se estiver online, dispara sincronização
      if (ConnectivityService.instance.isOnline) {
        // Start sync without awaiting. Avoid adding a new dependency for `unawaited`.
        // The ignore comment silences the `unawaited_futures` linter for this line.
        // ignore: unawaited_futures
        _syncService.sync();
      }
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  Future<void> loadTasks() async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();

      _tasks = await _db.getAllTasks(userId: _userId);

      _isLoading = false;
      notifyListeners();
    } catch (error) {
      _error = error.toString();
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> createTask({
    required String title,
    required String description,
    String priority = 'medium',
    String? photoPath,
    double? latitude,
    double? longitude,
    String? locationName,
  }) async {
    try {
      if (kDebugMode) {
        debugPrint(
            'TaskProvider.createTask: creating task locally title="$title"');
      }
      final task = Task(
        title: title,
        description: description,
        priority: priority,
        userId: _userId,
        photoPath: photoPath,
        latitude: latitude,
        longitude: longitude,
        locationName: locationName,
      );
      await _syncService.createTask(task);
      if (kDebugMode) {
        debugPrint('TaskProvider.createTask: created task id=${task.id}');
      }
      await loadTasks();
    } catch (error) {
      _error = error.toString();
      if (kDebugMode) debugPrint('TaskProvider.createTask error: $_error');
      notifyListeners();
    }
  }

  Future<void> updateTask(Task task) async {
    try {
      await _syncService.updateTask(task);
      await loadTasks();
    } catch (error) {
      _error = error.toString();
      notifyListeners();
    }
  }

  Future<void> toggleCompleted(Task task) async {
    await updateTask(
      task.copyWith(
        completed: !task.completed,
      ),
    );
  }

  Future<void> deleteTask(String taskId) async {
    try {
      await _syncService.deleteTask(taskId);
      await loadTasks();
    } catch (error) {
      _error = error.toString();
      notifyListeners();
    }
  }

  Future<SyncResult> sync() async {
    final result = await _syncService.sync();
    await loadTasks();
    return result;
  }

  /// Safe sync wrapper: optional delay to let network settle, catches errors
  /// and prevents exceptions from propagating to callers (useful when
  /// invoked from connectivity listeners where native debugger may detach).
  Future<void> safeSync({Duration delay = const Duration(seconds: 2)}) async {
    try {
      if (delay > Duration.zero) {
        await Future.delayed(delay);
      }
      final result = await sync();
      if (kDebugMode) {
        debugPrint('TaskProvider.safeSync: ${result.message}');
      }
    } catch (e, st) {
      _error = e.toString();
      if (kDebugMode) {
        debugPrint('TaskProvider.safeSync error: $e');
        debugPrintStack(stackTrace: st);
      }
      notifyListeners();
    }
  }

  Future<SyncStats> getSyncStats() => _syncService.getStats();

  @override
  void dispose() {
    _syncService.dispose();
    super.dispose();
  }

  /// Expose sync events stream to UI for SnackBars and notifications
  Stream<SyncEvent> get syncStream => _syncService.syncStatusStream;
}

import 'package:flutter/foundation.dart';

import '../models/task.dart';
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
  }) async {
    try {
      final task = Task(
        title: title,
        description: description,
        priority: priority,
        userId: _userId,
      );
      await _syncService.createTask(task);
      await loadTasks();
    } catch (error) {
      _error = error.toString();
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

  Future<SyncStats> getSyncStats() => _syncService.getStats();

  @override
  void dispose() {
    _syncService.dispose();
    super.dispose();
  }
}

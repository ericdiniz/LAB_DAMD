import '../models/task.dart';

/// Estratégias auxiliares para resolução de conflitos
class ConflictResolver {
  const ConflictResolver._();

  /// Estratégia Last-Write-Wins (LWW)
  static Task resolveLastWriteWins(Task localTask, Task serverTask) {
    final localTime = localTask.localUpdatedAt ?? localTask.updatedAt;
    final serverTime = serverTask.updatedAt;
    return localTime.isAfter(serverTime) ? localTask : serverTask;
  }
}

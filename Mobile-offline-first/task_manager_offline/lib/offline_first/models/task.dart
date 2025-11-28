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
  final SyncStatus syncStatus;
  final DateTime? localUpdatedAt;
  final DateTime? lastSynced;

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
    this.lastSynced,
  })  : id = id ?? const Uuid().v4(),
        createdAt = createdAt ?? DateTime.now(),
        updatedAt = updatedAt ?? DateTime.now();

  /// Criar cópia com modificações
  Task copyWith({
    String? title,
    String? description,
    bool? completed,
    String? priority,
    String? userId,
    DateTime? createdAt,
    DateTime? updatedAt,
    int? version,
    SyncStatus? syncStatus,
    DateTime? localUpdatedAt,
    DateTime? lastSynced,
  }) {
    return Task(
      id: id,
      title: title ?? this.title,
      description: description ?? this.description,
      completed: completed ?? this.completed,
      priority: priority ?? this.priority,
      userId: userId ?? this.userId,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      version: version ?? this.version,
      syncStatus: syncStatus ?? this.syncStatus,
      localUpdatedAt: localUpdatedAt ?? this.localUpdatedAt,
      lastSynced: lastSynced ?? this.lastSynced,
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
      'syncStatus': syncStatus.name,
      'localUpdatedAt': localUpdatedAt?.millisecondsSinceEpoch,
      'lastSynced': lastSynced?.millisecondsSinceEpoch,
    };
  }

  /// Criar Task a partir de Map
  factory Task.fromMap(Map<String, dynamic> map) {
    return Task(
      id: map['id'] as String,
      title: map['title'] as String,
      description: (map['description'] ?? '') as String,
      completed: map['completed'] == 1,
      priority: (map['priority'] ?? 'medium') as String,
      userId: (map['userId'] ?? 'user1') as String,
      createdAt: _parseDate(map['createdAt']) ?? DateTime.now(),
      updatedAt: _parseDate(map['updatedAt']) ?? DateTime.now(),
      version: (map['version'] ?? 1) as int,
      syncStatus: _parseSyncStatus(map['syncStatus']) ?? SyncStatus.synced,
      localUpdatedAt: _parseDate(map['localUpdatedAt']),
      lastSynced: _parseDate(map['lastSynced']),
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
      id: (json['id'] ?? json['taskId']) as String,
      title: (json['title'] ?? '') as String,
      description: (json['description'] ?? '') as String,
      completed: (json['completed'] ?? false) as bool,
      priority: (json['priority'] ?? 'medium') as String,
      userId: (json['userId'] ?? json['user_id'] ?? 'user1') as String,
      createdAt: _parseDate(json['createdAt']) ?? DateTime.now(),
      updatedAt: _parseDate(json['updatedAt']) ?? DateTime.now(),
      version: (json['version'] ?? 1) as int,
      syncStatus: SyncStatus.synced,
      lastSynced: _parseDate(json['lastSynced']),
    );
  }

  @override
  String toString() {
    return 'Task(id: $id, title: $title, syncStatus: $syncStatus)';
  }

  static DateTime? _parseDate(dynamic value) {
    if (value == null) return null;
    if (value is int) {
      return DateTime.fromMillisecondsSinceEpoch(value);
    }
    if (value is String && value.isNotEmpty) {
      final parsed = int.tryParse(value);
      if (parsed != null) {
        return DateTime.fromMillisecondsSinceEpoch(parsed);
      }
      return DateTime.tryParse(value);
    }
    return null;
  }

  static SyncStatus? _parseSyncStatus(dynamic value) {
    if (value == null) {
      return null;
    }
    if (value is SyncStatus) {
      return value;
    }
    final normalized = value.toString().split('.').last.toLowerCase();
    for (final status in SyncStatus.values) {
      if (status.name.toLowerCase() == normalized) {
        return status;
      }
    }
    return null;
  }
}

/// Status de sincronização da tarefa
enum SyncStatus {
  synced,
  pending,
  conflict,
  error,
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

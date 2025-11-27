import 'dart:convert';

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
      'type': type.name,
      'taskId': taskId,
      'data': jsonEncode(data),
      'timestamp': timestamp.millisecondsSinceEpoch,
      'retries': retries,
      'status': status.name,
      'error': error,
    };
  }

  /// Criar a partir de Map
  factory SyncOperation.fromMap(Map<String, dynamic> map) {
    return SyncOperation(
      id: map['id'] as String,
      type: _parseOperationType(map['type']) ?? OperationType.create,
      taskId: map['taskId'] as String,
      data: _parseData(map['data']),
      timestamp: TaskDateParser.parse(map['timestamp']) ?? DateTime.now(),
      retries: (map['retries'] ?? 0) as int,
      status: _parseStatus(map['status']) ?? SyncOperationStatus.pending,
      error: map['error'] as String?,
    );
  }

  static Map<String, dynamic> _parseData(dynamic dataStr) {
    if (dataStr == null) {
      return const {};
    }
    if (dataStr is Map<String, dynamic>) {
      return dataStr;
    }
    if (dataStr is String && dataStr.isNotEmpty) {
      try {
        final decoded = jsonDecode(dataStr);
        if (decoded is Map<String, dynamic>) {
          return decoded;
        }
      } catch (_) {
        // Ignorar erros de parsing e retornar mapa vazio
      }
    }
    return const {};
  }

  static OperationType? _parseOperationType(dynamic value) {
    if (value == null) {
      return null;
    }
    final normalized = value.toString().split('.').last.toLowerCase();
    for (final type in OperationType.values) {
      if (type.name.toLowerCase() == normalized) {
        return type;
      }
    }
    return null;
  }

  static SyncOperationStatus? _parseStatus(dynamic value) {
    if (value == null) {
      return null;
    }
    final normalized = value.toString().split('.').last.toLowerCase();
    for (final status in SyncOperationStatus.values) {
      if (status.name.toLowerCase() == normalized) {
        return status;
      }
    }
    return null;
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

/// Utilitário simples para converter timestamps flexíveis
class TaskDateParser {
  static DateTime? parse(dynamic value) {
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
}

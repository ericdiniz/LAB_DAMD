import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/task.dart';

/// Serviço de comunicação com API REST do servidor
class ApiService {
  ApiService({this.userId = 'user1'});

  static const String baseUrl = 'http://10.0.2.2:3000/api';
  // static const String baseUrl = 'http://localhost:3000/api'; // iOS simulator

  final String userId;

  /// Buscar todas as tarefas (com sync incremental)
  Future<Map<String, dynamic>> getTasks({int? modifiedSince}) async {
    try {
      final uri = Uri.parse('$baseUrl/tasks').replace(
        queryParameters: {
          'userId': userId,
          if (modifiedSince != null) 'modifiedSince': modifiedSince.toString(),
        },
      );

      final response = await http.get(uri).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = json.decode(response.body) as Map<String, dynamic>;
        final tasksJson =
            List<Map<String, dynamic>>.from(data['tasks'] as List);
        return {
          'success': true,
          'tasks': tasksJson.map(Task.fromJson).toList(),
          'serverTime': data['serverTime'],
        };
      }

      throw Exception('Erro ao buscar tarefas: ${response.statusCode}');
    } catch (error) {
      rethrow;
    }
  }

  /// Criar tarefa no servidor
  Future<Task> createTask(Task task) async {
    try {
      final response = await http
          .post(
            Uri.parse('$baseUrl/tasks'),
            headers: const {'Content-Type': 'application/json'},
            body: json.encode(task.toJson()),
          )
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 201) {
        final data = json.decode(response.body) as Map<String, dynamic>;
        return Task.fromJson(data['task'] as Map<String, dynamic>);
      }

      throw Exception('Erro ao criar tarefa: ${response.statusCode}');
    } catch (error) {
      rethrow;
    }
  }

  /// Atualizar tarefa no servidor
  Future<Map<String, dynamic>> updateTask(Task task) async {
    try {
      final response = await http
          .put(
            Uri.parse('$baseUrl/tasks/${task.id}'),
            headers: const {'Content-Type': 'application/json'},
            body: json.encode({
              ...task.toJson(),
              'version': task.version,
            }),
          )
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = json.decode(response.body) as Map<String, dynamic>;
        return {
          'task': Task.fromJson(data['task'] as Map<String, dynamic>),
          'conflict': false,
        };
      }

      if (response.statusCode == 409) {
        final data = json.decode(response.body) as Map<String, dynamic>;
        return {
          'conflict': true,
          'serverTask': Task.fromJson(
            data['serverTask'] as Map<String, dynamic>,
          ),
        };
      }

      throw Exception('Erro ao atualizar tarefa: ${response.statusCode}');
    } catch (error) {
      rethrow;
    }
  }

  /// Deletar tarefa no servidor
  Future<bool> deleteTask(String id, int version) async {
    try {
      final response = await http
          .delete(
            Uri.parse('$baseUrl/tasks/$id?version=$version'),
          )
          .timeout(const Duration(seconds: 10));

      return response.statusCode == 200 || response.statusCode == 404;
    } catch (error) {
      rethrow;
    }
  }

  /// Sincronização em lote
  Future<List<Map<String, dynamic>>> syncBatch(
    List<Map<String, dynamic>> operations,
  ) async {
    try {
      final response = await http
          .post(
            Uri.parse('$baseUrl/sync/batch'),
            headers: const {'Content-Type': 'application/json'},
            body: json.encode({'operations': operations}),
          )
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = json.decode(response.body) as Map<String, dynamic>;
        return List<Map<String, dynamic>>.from(data['results'] as List);
      }

      throw Exception('Erro no sync em lote: ${response.statusCode}');
    } catch (error) {
      rethrow;
    }
  }

  /// Verificar conectividade com servidor
  Future<bool> checkConnectivity() async {
    try {
      final response = await http
          .get(Uri.parse('$baseUrl/health'))
          .timeout(const Duration(seconds: 5));

      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }
}

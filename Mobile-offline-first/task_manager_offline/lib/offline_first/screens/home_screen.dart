import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../services/sensor_service.dart';
import '../models/task.dart';
import '../providers/task_provider.dart';
import '../services/connectivity_service.dart';
import '../services/sync_service.dart';
import '../widgets/sync_indicator.dart';
import '../widgets/task_card.dart';
import 'sync_status_screen.dart';
import 'task_form_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final ConnectivityService _connectivity = ConnectivityService.instance;
  bool _isOnline = true;
  StreamSubscription<SyncEvent>? _syncSub;

  @override
  void initState() {
    super.initState();
    _initializeConnectivity();
    // iniciar detecção de "shake" para ações rápidas
    try {
      SensorService.instance.startShakeDetection(() {
        if (!mounted) return;
        _onShakeDetected();
      });
    } catch (_) {}
  }

  void _onShakeDetected() async {
    final provider = context.read<TaskProvider>();
    final pending = provider.pendingTasks;
    if (pending.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('🎉 Nenhuma tarefa pendente!')),
      );
      return;
    }

    if (!mounted) return;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Completar tarefas por shake'),
        content: Text(
            'Deseja marcar ${pending.length} tarefa(s) como concluída(s)?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(c).pop(false),
              child: const Text('Cancelar')),
          TextButton(
              onPressed: () => Navigator.of(c).pop(true),
              child: const Text('Sim')),
        ],
      ),
    );

    if (confirm == true) {
      for (final t in pending) {
        await provider.updateTask(
          t.copyWith(
              completed: true,
              completedAt: DateTime.now(),
              completedBy: 'shake'),
        );
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content:
                Text('${pending.length} tarefa(s) marcadas como concluídas')),
      );
    }
  }

  Future<void> _initializeConnectivity() async {
    await _connectivity.initialize();
    setState(() => _isOnline = _connectivity.isOnline);

    _connectivity.connectivityStream.listen((isOnline) {
      try {
        if (!mounted) {
          return;
        }
        setState(() => _isOnline = isOnline);
        if (isOnline) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('🟢 Conectado - sincronizando...')),
          );
          // Disparar sincronização 'segura' com pequeno delay para evitar
          // problemas no momento exato da transição de rede (stack nativa ainda
          // se estabilizando). não await aqui (fire-and-forget) para não bloquear UI.
          try {
            // ignore: unawaited_futures
            context
                .read<TaskProvider>()
                .safeSync(delay: const Duration(seconds: 2));
          } catch (e, st) {
            if (kDebugMode) {
              debugPrint('Erro ao disparar safeSync no listener: $e');
              debugPrintStack(stackTrace: st);
            }
          }
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('🔴 Modo offline')),
          );
        }
      } catch (e, st) {
        if (kDebugMode) {
          debugPrint('Erro no listener de conectividade: $e');
          debugPrintStack(stackTrace: st);
        }
      }
    });

    // Inscrever-se em eventos de sincronização para notificar usuário quando terminar
    WidgetsBinding.instance.addPostFrameCallback((_) {
      try {
        final provider = context.read<TaskProvider>();
        _syncSub = provider.syncStream.listen((event) {
          if (!mounted) return;
          String message;
          if (event.type == SyncEventType.completed) {
            final pushed = event.data?['pushed'] ?? 0;
            final pulled = event.data?['pulled'] ?? 0;
            message = 'Sincronização finalizada (push: $pushed, pull: $pulled)';
          } else if (event.type == SyncEventType.error) {
            message = 'Erro na sincronização: ${event.message}';
          } else if (event.type == SyncEventType.conflictResolved) {
            message = 'Conflito resolvido: ${event.message}';
          } else {
            return;
          }

          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(message)),
          );
        });
      } catch (_) {}
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tarefas Offline-First'),
        actions: [
          IconButton(
            onPressed: _handleManualSync,
            icon: const Icon(Icons.sync),
          ),
          IconButton(
            onPressed: _navigateToSyncStatus,
            icon: const Icon(Icons.dashboard),
          ),
        ],
      ),
      body: Consumer<TaskProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (provider.tasks.isEmpty) {
            return const Center(child: Text('Nenhuma tarefa cadastrada'));
          }

          return RefreshIndicator(
            onRefresh: () async {
              await provider.loadTasks();
              await provider.sync();
            },
            child: ListView.builder(
              physics: const AlwaysScrollableScrollPhysics(),
              itemCount: provider.tasks.length,
              itemBuilder: (context, index) {
                final task = provider.tasks[index];
                return OfflineTaskCard(
                  task: task,
                  onToggleCompleted: () => provider.toggleCompleted(task),
                  onEdit: () => _navigateToTaskForm(task),
                  onDelete: () => provider.deleteTask(task.id),
                );
              },
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _navigateToTaskForm(),
        icon: const Icon(Icons.add),
        label: const Text('Nova tarefa'),
      ),
      bottomNavigationBar: Consumer<TaskProvider>(
        builder: (context, provider, child) {
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: SyncIndicator(
              isOnline: _isOnline,
              unsyncedCount: provider.unsyncedTasks.length,
            ),
          );
        },
      ),
    );
  }

  Future<void> _handleManualSync() async {
    final provider = context.read<TaskProvider>();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('🔄 Sincronizando...')),
    );

    final result = await provider.sync();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(result.message)),
    );
  }

  void _navigateToTaskForm([Task? task]) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => TaskFormScreen(task: task),
      ),
    );
  }

  void _navigateToSyncStatus() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => const SyncStatusScreen(),
      ),
    );
  }

  @override
  void dispose() {
    _syncSub?.cancel();
    super.dispose();
  }
}

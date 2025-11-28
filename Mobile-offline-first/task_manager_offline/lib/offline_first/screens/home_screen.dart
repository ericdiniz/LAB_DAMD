import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/task.dart';
import '../providers/task_provider.dart';
import '../services/connectivity_service.dart';
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

  @override
  void initState() {
    super.initState();
    _initializeConnectivity();
  }

  Future<void> _initializeConnectivity() async {
    await _connectivity.initialize();
    setState(() => _isOnline = _connectivity.isOnline);

    _connectivity.connectivityStream.listen((isOnline) {
      if (!mounted) {
        return;
      }
      setState(() => _isOnline = isOnline);
      if (isOnline) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('🟢 Conectado - sincronizando...')),
        );
        context.read<TaskProvider>().sync();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('🔴 Modo offline')),
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tarefas Offline-First (DEV BUILD)'),
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
}

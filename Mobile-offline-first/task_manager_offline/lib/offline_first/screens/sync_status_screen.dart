import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../providers/task_provider.dart';
import '../services/sync_service.dart';

class SyncStatusScreen extends StatelessWidget {
  const SyncStatusScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Estado da sincronização'),
      ),
      body: FutureBuilder<SyncStats>(
        future: context.read<TaskProvider>().getSyncStats(),
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }

          if (!snapshot.hasData) {
            return const Center(
                child: Text('Não foi possível carregar os dados'));
          }

          final stats = snapshot.data!;
          return Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildStatusCard(
                  title: 'Total de tarefas',
                  icon: Icons.task,
                  value: stats.totalTasks.toString(),
                  color: Colors.blue,
                ),
                _buildStatusCard(
                  title: 'Pendentes de sync',
                  icon: Icons.sync_problem,
                  value: stats.unsyncedTasks.toString(),
                  color: Colors.orange,
                ),
                _buildStatusCard(
                  title: 'Fila de operações',
                  icon: Icons.playlist_add_check,
                  value: stats.queuedOperations.toString(),
                  color: Colors.purple,
                ),
                const SizedBox(height: 16),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Última sincronização'),
                  subtitle: Text(
                    stats.lastSync != null
                        ? DateFormat.yMd().add_Hm().format(stats.lastSync!)
                        : 'Ainda não sincronizado',
                  ),
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Status atual'),
                  subtitle: Text(stats.isSyncing
                      ? 'Sincronizando...'
                      : stats.isOnline
                          ? 'Online'
                          : 'Offline'),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.redAccent,
                        ),
                        onPressed: () async {
                          final ok = await showDialog<bool>(
                            context: context,
                            builder: (ctx) => AlertDialog(
                              title: const Text('Confirmar'),
                              content: const Text(
                                  'Deseja limpar toda a fila de sincronização? Essa ação não pode ser desfeita.'),
                              actions: [
                                TextButton(
                                  onPressed: () => Navigator.of(ctx).pop(false),
                                  child: const Text('Cancelar'),
                                ),
                                TextButton(
                                  onPressed: () => Navigator.of(ctx).pop(true),
                                  child: const Text('Confirmar'),
                                ),
                              ],
                            ),
                          );

                          if (ok == true) {
                            await context.read<TaskProvider>().clearSyncQueue();
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                    content:
                                        Text('Fila de sincronização limpa')),
                              );
                            }
                          }
                        },
                        icon: const Icon(Icons.delete_forever),
                        label: const Text('Limpar fila'),
                      ),
                    ),
                  ],
                ),
                const Spacer(),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () async {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('🔄 Sincronizando...')),
                      );
                      final result = await context.read<TaskProvider>().sync();
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(result.message)),
                        );
                        // Força rebuild para mostrar dados atualizados
                        (context as Element).reassemble();
                      }
                    },
                    icon: const Icon(Icons.sync),
                    label: const Text('Sincronizar agora'),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildStatusCard({
    required String title,
    required IconData icon,
    required String value,
    required Color color,
  }) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: color.withOpacity(0.15),
          child: Icon(icon, color: color),
        ),
        title: Text(title),
        trailing: Text(
          value,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
      ),
    );
  }
}

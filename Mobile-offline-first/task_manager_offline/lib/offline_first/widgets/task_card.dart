import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/task.dart';
import '../utils/constants.dart';

class OfflineTaskCard extends StatelessWidget {
  const OfflineTaskCard({
    super.key,
    required this.task,
    required this.onToggleCompleted,
    required this.onEdit,
    required this.onDelete,
  });

  final Task task;
  final VoidCallback onToggleCompleted;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final priorityColor = Color(
      OfflineConstants.priorityColors[task.priority] ?? 0xFF64B5F6,
    );
    final updatedAt = DateFormat.yMd().add_Hm().format(task.updatedAt);
    final lastSyncedStr = task.lastSynced != null
        ? DateFormat.yMd().add_Hm().format(task.lastSynced!)
        : null;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: ListTile(
        contentPadding:
            const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
        leading: CircleAvatar(
          backgroundColor: priorityColor,
          child: Icon(
            task.completed ? Icons.check : Icons.pending,
            color: Colors.white,
          ),
        ),
        title: Text(
          task.title,
          style: TextStyle(
            fontWeight: FontWeight.w600,
            decoration: task.completed ? TextDecoration.lineThrough : null,
          ),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (task.description.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(task.description),
              ),
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Row(
                children: [
                  _buildTag(task.priority.toUpperCase(), priorityColor),
                  const SizedBox(width: 8),
                  _buildTag(task.syncStatus.icon, _syncStatusColor()),
                  const SizedBox(width: 8),
                  if (task.syncStatus == SyncStatus.synced)
                    _buildTag('Sincronizado', const Color(0xFF66BB6A)),
                  const SizedBox(width: 8),
                  Text('Atualizado: $updatedAt'),
                  if (lastSyncedStr != null) ...[
                    const SizedBox(width: 8),
                    Text('Synced: $lastSyncedStr'),
                  ],
                ],
              ),
            ),
          ],
        ),
        trailing: PopupMenuButton<String>(
          onSelected: (value) {
            switch (value) {
              case 'toggle':
                onToggleCompleted();
                break;
              case 'edit':
                onEdit();
                break;
              case 'delete':
                onDelete();
            }
          },
          itemBuilder: (context) => const [
            PopupMenuItem(value: 'toggle', child: Text('Alternar status')),
            PopupMenuItem(value: 'edit', child: Text('Editar')),
            PopupMenuItem(value: 'delete', child: Text('Excluir')),
          ],
        ),
      ),
    );
  }

  Widget _buildTag(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withAlpha((0.15 * 255).round()),
        borderRadius: const BorderRadius.all(Radius.circular(12)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Color _syncStatusColor() {
    switch (task.syncStatus) {
      case SyncStatus.synced:
        return const Color(0xFF66BB6A);
      case SyncStatus.pending:
        return const Color(0xFFFFB74D);
      case SyncStatus.conflict:
        return const Color(0xFFFF7043);
      case SyncStatus.error:
        return const Color(0xFFE57373);
    }
  }
}

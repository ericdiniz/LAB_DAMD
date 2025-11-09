import 'package:flutter/material.dart';

import '../models/task.dart';

class ConflictDialog extends StatelessWidget {
  const ConflictDialog({
    super.key,
    required this.localTask,
    required this.serverTask,
  });

  final Task localTask;
  final Task serverTask;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Conflito de sincronização'),
      content: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Versão local:'),
            const SizedBox(height: 4),
            Text(
              localTask.description,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 12),
            const Text('Versão do servidor:'),
            const SizedBox(height: 4),
            Text(serverTask.description),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, 'local'),
          child: const Text('Manter local'),
        ),
        TextButton(
          onPressed: () => Navigator.pop(context, 'server'),
          child: const Text('Manter servidor'),
        ),
      ],
    );
  }
}

import 'package:flutter/material.dart';

class SyncIndicator extends StatelessWidget {
  const SyncIndicator({
    super.key,
    required this.isOnline,
    required this.unsyncedCount,
  });

  final bool isOnline;
  final int unsyncedCount;

  @override
  Widget build(BuildContext context) {
    final color = isOnline ? Colors.green : Colors.red;
    final label = isOnline ? 'Online' : 'Offline';

    return Row(
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 8),
        Text(label),
        if (unsyncedCount > 0) ...[
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.orange.withOpacity(0.2),
              borderRadius: const BorderRadius.all(Radius.circular(12)),
            ),
            child: Text(
              '$unsyncedCount pendente(s)',
              style: const TextStyle(
                color: Colors.orange,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class OfflineConstants {
  const OfflineConstants._();

  static const priorities = <String, String>{
    'low': 'Baixa',
    'medium': 'Média',
    'high': 'Alta',
    'urgent': 'Urgente',
  };

  static const priorityColors = <String, int>{
    'low': 0xFF81C784,
    'medium': 0xFF64B5F6,
    'high': 0xFFFFB74D,
    'urgent': 0xFFE57373,
  };
}

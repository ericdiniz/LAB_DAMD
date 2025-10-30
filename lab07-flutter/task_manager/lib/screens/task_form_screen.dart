import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import '../models/category.dart';
import '../models/task.dart';
import '../services/camera_service.dart';
import '../services/database_service.dart';
import '../services/location_service.dart';
import '../widgets/location_picker.dart';

class TaskFormScreen extends StatefulWidget {
  final Task? task;

  const TaskFormScreen({super.key, this.task});

  @override
  State<TaskFormScreen> createState() => _TaskFormScreenState();
}

class _TaskFormScreenState extends State<TaskFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();

  String _priority = 'medium';
  bool _completed = false;
  bool _isSaving = false;
  DateTime? _dueDate;
  late String _categoryId;
  String? _photoPath;
  double? _latitude;
  double? _longitude;
  String? _locationName;
  final ImagePicker _imagePicker = ImagePicker();

  @override
  void initState() {
    super.initState();
    _categoryId = Categories.defaultCategory().id;
    if (widget.task != null) {
      _titleController.text = widget.task!.title;
      _descriptionController.text = widget.task!.description;
      _priority = widget.task!.priority;
      _completed = widget.task!.completed;
      _dueDate = widget.task!.dueDate;
      _categoryId = widget.task!.categoryId ?? _categoryId;
      _photoPath = widget.task!.photoPath;
      _latitude = widget.task!.latitude;
      _longitude = widget.task!.longitude;
      _locationName = widget.task!.locationName;
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  // Handles both creation and update flows, showing feedback for each case.
  Future<void> _saveTask() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _isSaving = true);

    try {
      if (widget.task == null) {
        final task = Task(
          title: _titleController.text.trim(),
          description: _descriptionController.text.trim(),
          priority: _priority,
          completed: _completed,
          dueDate: _dueDate,
          categoryId: _categoryId,
          photoPath: _photoPath,
          latitude: _latitude,
          longitude: _longitude,
          locationName: _locationName,
        );
        await DatabaseService.instance.create(task);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('✓ Tarefa criada com sucesso'),
              backgroundColor: Colors.green,
              duration: Duration(seconds: 2),
            ),
          );
        }
      } else {
        final updated = widget.task!.copyWith(
          title: _titleController.text.trim(),
          description: _descriptionController.text.trim(),
          priority: _priority,
          completed: _completed,
          dueDate: _dueDate,
          overrideDueDate: true,
          categoryId: _categoryId,
          overrideCategory: true,
          photoPath: _photoPath,
          overridePhoto: true,
          latitude: _latitude,
          longitude: _longitude,
          locationName: _locationName,
          overrideLocation: true,
        );
        await DatabaseService.instance.update(updated);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('✓ Tarefa atualizada'),
              backgroundColor: Colors.blue,
              duration: Duration(seconds: 2),
            ),
          );
        }
      }

      if (mounted) {
        Navigator.pop(context, true);
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erro ao salvar tarefa: $error'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  Future<void> _takePicture() async {
    final path = await CameraService.instance.takePicture(context);
    if (path != null && mounted) {
      setState(() => _photoPath = path);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('📷 Foto capturada!'),
          backgroundColor: Colors.green,
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  void _removePhoto() {
    setState(() => _photoPath = null);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('🗑️ Foto removida'),
        duration: Duration(seconds: 2),
      ),
    );
  }

  Future<void> _pickLocation() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (context) => LocationPicker(
        initialLatitude: _latitude,
        initialLongitude: _longitude,
        initialAddress: _locationName,
        onLocationSelected: (lat, lon, address) {
          setState(() {
            _latitude = lat;
            _longitude = lon;
            _locationName = address;
          });
        },
      ),
    );
  }

  void _removeLocation() {
    setState(() {
      _latitude = null;
      _longitude = null;
      _locationName = null;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('📍 Localização removida'),
        duration: Duration(seconds: 2),
      ),
    );
  }

  Future<void> _pickFromGallery() async {
    try {
      final image = await _imagePicker.pickImage(source: ImageSource.gallery);
      if (image == null) {
        return;
      }

      final savedPath = await CameraService.instance.savePicture(image);
      if (!mounted) return;
      setState(() => _photoPath = savedPath);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('🖼️ Imagem adicionada da galeria'),
          backgroundColor: Colors.blue,
          duration: Duration(seconds: 2),
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Erro ao selecionar imagem: $error'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  void _viewPhoto() {
    if (_photoPath == null) return;

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => Scaffold(
          appBar: AppBar(
            title: const Text('Pré-visualização'),
          ),
          backgroundColor: Colors.black,
          body: Center(
            child: InteractiveViewer(
              child: Image.file(File(_photoPath!)),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _pickDueDate() async {
    final now = DateTime.now();
    final initialDate = _dueDate ?? now;
    final selectedDate = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 5),
      helpText: 'Selecionar data de vencimento',
    );

    if (selectedDate != null) {
      setState(() {
        _dueDate = DateTime(
          selectedDate.year,
          selectedDate.month,
          selectedDate.day,
        );
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEditing = widget.task != null;
    final dateFormat = DateFormat('dd/MM/yyyy');

    return Scaffold(
      appBar: AppBar(
        title: Text(isEditing ? 'Editar Tarefa' : 'Nova Tarefa'),
        backgroundColor: Theme.of(context).colorScheme.primary,
        foregroundColor: Theme.of(context).colorScheme.onPrimary,
      ),
      body: _isSaving
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      controller: _titleController,
                      decoration: const InputDecoration(
                        labelText: 'Título *',
                        hintText: 'Ex: Estudar Flutter',
                        prefixIcon: Icon(Icons.title),
                        border: OutlineInputBorder(),
                      ),
                      textCapitalization: TextCapitalization.sentences,
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return 'Informe um título';
                        }
                        if (value.trim().length < 3) {
                          return 'Título deve ter pelo menos 3 caracteres';
                        }
                        return null;
                      },
                      maxLength: 100,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _descriptionController,
                      decoration: const InputDecoration(
                        labelText: 'Descrição',
                        hintText: 'Adicione mais detalhes...',
                        prefixIcon: Icon(Icons.description),
                        border: OutlineInputBorder(),
                        alignLabelWithHint: true,
                      ),
                      textCapitalization: TextCapitalization.sentences,
                      maxLength: 500,
                      maxLines: 5,
                    ),
                    const SizedBox(height: 16),
                    DropdownButtonFormField<String>(
                      initialValue: _priority,
                      decoration: const InputDecoration(
                        labelText: 'Prioridade',
                        prefixIcon: Icon(Icons.flag),
                        border: OutlineInputBorder(),
                      ),
                      items: const [
                        DropdownMenuItem(
                          value: 'low',
                          child: Row(
                            children: [
                              Icon(Icons.flag, color: Colors.green),
                              SizedBox(width: 8),
                              Text('Baixa'),
                            ],
                          ),
                        ),
                        DropdownMenuItem(
                          value: 'medium',
                          child: Row(
                            children: [
                              Icon(Icons.flag, color: Colors.orange),
                              SizedBox(width: 8),
                              Text('Média'),
                            ],
                          ),
                        ),
                        DropdownMenuItem(
                          value: 'high',
                          child: Row(
                            children: [
                              Icon(Icons.flag, color: Colors.red),
                              SizedBox(width: 8),
                              Text('Alta'),
                            ],
                          ),
                        ),
                        DropdownMenuItem(
                          value: 'urgent',
                          child: Row(
                            children: [
                              Icon(Icons.priority_high, color: Colors.purple),
                              SizedBox(width: 8),
                              Text('Urgente'),
                            ],
                          ),
                        ),
                      ],
                      onChanged: (value) {
                        if (value != null) {
                          setState(() => _priority = value);
                        }
                      },
                    ),
                    const SizedBox(height: 16),
                    DropdownButtonFormField<String>(
                      initialValue: _categoryId,
                      decoration: const InputDecoration(
                        labelText: 'Categoria',
                        prefixIcon: Icon(Icons.category_outlined),
                        border: OutlineInputBorder(),
                      ),
                      items: [
                        for (final category in Categories.all)
                          DropdownMenuItem(
                            value: category.id,
                            child: Row(
                              children: [
                                Icon(category.icon, color: category.color),
                                const SizedBox(width: 8),
                                Text(category.name),
                              ],
                            ),
                          ),
                      ],
                      onChanged: (value) {
                        if (value != null) {
                          setState(() => _categoryId = value);
                        }
                      },
                    ),
                    const SizedBox(height: 16),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  Icons.location_on_outlined,
                                  color: Theme.of(context).colorScheme.primary,
                                ),
                                const SizedBox(width: 8),
                                const Text(
                                  'Localização',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                const Spacer(),
                                if (_latitude != null)
                                  IconButton(
                                    tooltip: 'Remover localização',
                                    onPressed: _removeLocation,
                                    icon: const Icon(Icons.delete_outline),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            if (_latitude != null && _longitude != null)
                              ListTile(
                                contentPadding: EdgeInsets.zero,
                                title: Text(
                                  _locationName ??
                                      LocationService.instance
                                          .formatCoordinates(
                                              _latitude!, _longitude!),
                                ),
                                subtitle: Text(
                                  LocationService.instance.formatCoordinates(
                                    _latitude!,
                                    _longitude!,
                                  ),
                                ),
                                trailing: IconButton(
                                  tooltip: 'Alterar localização',
                                  icon: const Icon(Icons.edit_location_alt),
                                  onPressed: _pickLocation,
                                ),
                              )
                            else
                              OutlinedButton.icon(
                                onPressed: _pickLocation,
                                icon: const Icon(Icons.add_location_alt),
                                label: const Text('Adicionar localização'),
                              ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  Icons.camera_alt_outlined,
                                  color: Theme.of(context).colorScheme.primary,
                                ),
                                const SizedBox(width: 8),
                                const Text(
                                  'Anexar foto',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            if (_photoPath != null)
                              ClipRRect(
                                borderRadius: BorderRadius.circular(12),
                                child: Stack(
                                  children: [
                                    AspectRatio(
                                      aspectRatio: 16 / 9,
                                      child: Image.file(
                                        File(_photoPath!),
                                        fit: BoxFit.cover,
                                      ),
                                    ),
                                    Positioned(
                                      top: 8,
                                      right: 8,
                                      child: Row(
                                        children: [
                                          IconButton.filledTonal(
                                            onPressed: _viewPhoto,
                                            icon: const Icon(Icons.zoom_in),
                                            tooltip: 'Visualizar',
                                          ),
                                          const SizedBox(width: 8),
                                          IconButton.filledTonal(
                                            onPressed: _removePhoto,
                                            icon: const Icon(Icons.delete),
                                            tooltip: 'Remover',
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              )
                            else
                              Container(
                                height: 140,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: Colors.grey.shade300,
                                  ),
                                ),
                                alignment: Alignment.center,
                                child: const Text(
                                  'Nenhuma foto anexada',
                                  style: TextStyle(color: Colors.grey),
                                ),
                              ),
                            const SizedBox(height: 12),
                            FilledButton.icon(
                              onPressed: _takePicture,
                              icon: const Icon(Icons.camera),
                              label: Text(
                                _photoPath == null
                                    ? 'Capturar foto'
                                    : 'Capturar outra foto',
                              ),
                            ),
                            const SizedBox(height: 8),
                            OutlinedButton.icon(
                              onPressed: _pickFromGallery,
                              icon: const Icon(Icons.photo_library),
                              label: const Text('Selecionar da galeria'),
                            )
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Card(
                      child: ListTile(
                        leading: Icon(
                          Icons.event,
                          color: _dueDate != null
                              ? Theme.of(context).colorScheme.primary
                              : Colors.grey,
                        ),
                        title: const Text('Data de vencimento'),
                        subtitle: Text(
                          _dueDate != null
                              ? 'Vence em ${dateFormat.format(_dueDate!)}'
                              : 'Nenhuma data definida',
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (_dueDate != null)
                              IconButton(
                                tooltip: 'Limpar data',
                                icon: const Icon(Icons.clear),
                                onPressed: () =>
                                    setState(() => _dueDate = null),
                              ),
                            IconButton(
                              tooltip: 'Selecionar data',
                              icon: const Icon(Icons.calendar_today),
                              onPressed: _pickDueDate,
                            ),
                          ],
                        ),
                        onTap: _pickDueDate,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Card(
                      child: SwitchListTile(
                        value: _completed,
                        title: const Text('Tarefa completa'),
                        subtitle: Text(
                          _completed
                              ? 'Esta tarefa está concluída'
                              : 'Esta tarefa ainda está pendente',
                        ),
                        secondary: Icon(
                          _completed
                              ? Icons.check_circle
                              : Icons.radio_button_unchecked,
                          color: _completed ? Colors.green : Colors.grey,
                        ),
                        onChanged: (value) =>
                            setState(() => _completed = value),
                      ),
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton.icon(
                      onPressed: _saveTask,
                      icon: const Icon(Icons.save),
                      label:
                          Text(isEditing ? 'Atualizar Tarefa' : 'Criar Tarefa'),
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.all(16),
                      ),
                    ),
                    const SizedBox(height: 8),
                    OutlinedButton.icon(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.cancel),
                      label: const Text('Cancelar'),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.all(16),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}

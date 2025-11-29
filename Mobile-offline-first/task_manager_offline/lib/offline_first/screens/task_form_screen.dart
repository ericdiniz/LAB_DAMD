import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../screens/camera_screen.dart';
import '../../services/camera_service.dart';
import '../../widgets/location_picker.dart';
import '../models/task.dart';
import '../providers/task_provider.dart';
import '../utils/constants.dart';

class TaskFormScreen extends StatefulWidget {
  const TaskFormScreen({super.key, this.task});

  final Task? task;

  @override
  State<TaskFormScreen> createState() => _TaskFormScreenState();
}

class _TaskFormScreenState extends State<TaskFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _titleController;
  late TextEditingController _descriptionController;
  late String _priority;
  bool _isSaving = false;
  String? _photoPath;
  double? _latitude;
  double? _longitude;
  String? _locationName;

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController(text: widget.task?.title ?? '');
    _descriptionController =
        TextEditingController(text: widget.task?.description ?? '');
    _priority = widget.task?.priority ?? 'medium';
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _takePicture() async {
    if (!CameraService.instance.hasCameras) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Nenhuma câmera disponível')));
      }
      return;
    }
    final camera = CameraService.instance.primaryCamera!;
    final controller =
        CameraController(camera, ResolutionPreset.medium, enableAudio: false);
    try {
      await controller.initialize();
      if (!mounted) {
        try {
          await controller.dispose();
        } catch (_) {}
        return;
      }
      final path = await Navigator.of(context).push<String>(
        MaterialPageRoute(builder: (_) => CameraScreen(controller: controller)),
      );
      if (path != null) {
        // save to app-managed directory
        final saved = await CameraService.instance.savePicture(XFile(path));
        setState(() => _photoPath = saved);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Erro câmera: $e')));
      }
    } finally {
      try {
        controller.dispose();
      } catch (_) {}
    }
  }

  void _showLocationPicker() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (c) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(c).viewInsets.bottom),
        child: LocationPicker(
          initialLatitude: _latitude,
          initialLongitude: _longitude,
          initialAddress: _locationName,
          onLocationSelected: (lat, lon, addr) {
            setState(() {
              _latitude = lat;
              _longitude = lon;
              _locationName = addr;
            });
            Navigator.of(c).pop();
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isEditing = widget.task != null;

    return Scaffold(
      appBar: AppBar(
        title: Text(isEditing ? 'Editar tarefa' : 'Nova tarefa'),
        actions: [
          IconButton(
            onPressed: _isSaving ? null : _handleSubmit,
            icon: const Icon(Icons.save),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              TextFormField(
                controller: _titleController,
                decoration: const InputDecoration(
                  labelText: 'Título',
                  hintText: 'Descreva a tarefa',
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Informe um título';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _descriptionController,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: 'Descrição',
                  hintText: 'Detalhes da tarefa',
                ),
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: _priority,
                decoration: const InputDecoration(labelText: 'Prioridade'),
                items: OfflineConstants.priorities.entries
                    .map(
                      (entry) => DropdownMenuItem(
                        value: entry.key,
                        child: Text(entry.value),
                      ),
                    )
                    .toList(),
                onChanged: (value) {
                  if (value == null) {
                    return;
                  }
                  setState(() => _priority = value);
                },
              ),
              const SizedBox(height: 24),
              if (_photoPath != null) ...[
                Row(
                  children: [
                    Image.file(
                      File(_photoPath!),
                      width: 72,
                      height: 72,
                      fit: BoxFit.cover,
                    ),
                    const SizedBox(width: 12),
                    TextButton.icon(
                      onPressed: () async {
                        final deleted = await CameraService.instance
                            .deletePhoto(_photoPath!);
                        if (deleted) setState(() => _photoPath = null);
                      },
                      icon: const Icon(Icons.delete),
                      label: const Text('Remover foto'),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
              ],
              Row(
                children: [
                  ElevatedButton.icon(
                    onPressed: _takePicture,
                    icon: const Icon(Icons.camera_alt),
                    label: const Text('Tirar foto'),
                  ),
                  const SizedBox(width: 12),
                  ElevatedButton.icon(
                    onPressed: _showLocationPicker,
                    icon: const Icon(Icons.my_location),
                    label: const Text('Localização'),
                  ),
                ],
              ),
              if (_latitude != null && _longitude != null) ...[
                const SizedBox(height: 8),
                Text(
                    'Localização selecionada: ${_locationName ?? ''} (${_latitude!.toStringAsFixed(5)}, ${_longitude!.toStringAsFixed(5)})'),
              ],
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _isSaving ? null : _handleSubmit,
                  icon: const Icon(Icons.save),
                  label: Text(isEditing ? 'Atualizar' : 'Criar'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _isSaving = true);

    try {
      final provider = context.read<TaskProvider>();
      if (widget.task == null) {
        await provider.createTask(
          title: _titleController.text.trim(),
          description: _descriptionController.text.trim(),
          priority: _priority,
          photoPath: _photoPath,
          latitude: _latitude,
          longitude: _longitude,
          locationName: _locationName,
        );
      } else {
        await provider.updateTask(
          widget.task!.copyWith(
            title: _titleController.text.trim(),
            description: _descriptionController.text.trim(),
            priority: _priority,
            localUpdatedAt: DateTime.now(),
            photoPath: _photoPath,
            latitude: _latitude,
            longitude: _longitude,
            locationName: _locationName,
          ),
        );
      }

      if (!mounted) return;
      Navigator.of(context).pop();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro ao salvar: $error')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }
}

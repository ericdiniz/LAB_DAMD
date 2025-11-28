import 'package:flutter/material.dart';
import '../services/location_service.dart';

class LocationPicker extends StatefulWidget {
  final double? initialLatitude;
  final double? initialLongitude;
  final String? initialAddress;
  final void Function(double lat, double lon, String? address) onLocationSelected;

  const LocationPicker({
    super.key,
    this.initialLatitude,
    this.initialLongitude,
    this.initialAddress,
    required this.onLocationSelected,
  });

  @override
  State<LocationPicker> createState() => _LocationPickerState();
}

class _LocationPickerState extends State<LocationPicker> {
  final _controller = TextEditingController();
  bool _loading = false;
  double? _lat;
  double? _lon;
  String? _addr;

  @override
  void initState() {
    super.initState();
    _lat = widget.initialLatitude;
    _lon = widget.initialLongitude;
    _addr = widget.initialAddress;
    _controller.text = widget.initialAddress ?? '';
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _getCurrent() async {
    setState(() => _loading = true);
    final res = await LocationService.instance.getCurrentLocation();
    if (res != null && mounted) {
      final addr = await LocationService.instance.getAddressFromCoordinates(res.latitude, res.longitude);
      setState(() {
        _lat = res.latitude;
        _lon = res.longitude;
        _addr = addr;
        _controller.text = addr ?? '';
      });
      widget.onLocationSelected(_lat!, _lon!, _addr);
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _searchAddress() async {
    if (_controller.text.trim().isEmpty) return;
    setState(() => _loading = true);
    final pos = await LocationService.instance.getLocationFromAddress(_controller.text.trim());
    if (pos != null && mounted) {
      final addr = _controller.text.trim();
      setState(() {
        _lat = pos.latitude;
        _lon = pos.longitude;
        _addr = addr;
      });
      widget.onLocationSelected(_lat!, _lon!, _addr);
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Selecionar Localização', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          TextField(controller: _controller, decoration: const InputDecoration(labelText: 'Endereço'), onSubmitted: (_) => _searchAddress()),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: ElevatedButton.icon(onPressed: _loading ? null : _getCurrent, icon: const Icon(Icons.my_location), label: const Text('Usar localização'))),
            const SizedBox(width: 8),
            ElevatedButton.icon(onPressed: _loading ? null : _searchAddress, icon: const Icon(Icons.search), label: const Text('Buscar')),
          ]),
          if (_lat != null && _lon != null) ...[
            const SizedBox(height: 12),
            Text('Lat: ${_lat!.toStringAsFixed(6)} Lon: ${_lon!.toStringAsFixed(6)}'),
            if (_addr != null) Text('Endereço: $_addr'),
          ],
        ],
      ),
    );
  }
}
import 'package:flutter/material.dart';

import '../services/location_service.dart';

/// Modal content that lets the user either search for an address or
/// capture the current GPS position, returning the chosen coordinates.
class LocationPicker extends StatefulWidget {
  const LocationPicker({
    super.key,
    this.initialLatitude,
    this.initialLongitude,
    this.initialAddress,
    required this.onLocationSelected,
  });

  final double? initialLatitude;
  final double? initialLongitude;
  final String? initialAddress;
  final void Function(double latitude, double longitude, String? address)
      onLocationSelected;

  @override
  State<LocationPicker> createState() => _LocationPickerState();
}

class _LocationPickerState extends State<LocationPicker> {
  final _addressController = TextEditingController();
  bool _isLoading = false;
  double? _latitude;
  double? _longitude;
  String? _address;

  @override
  void initState() {
    super.initState();
    _latitude = widget.initialLatitude;
    _longitude = widget.initialLongitude;
    _address = widget.initialAddress;
    _addressController.text = widget.initialAddress ?? '';
  }

  @override
  void dispose() {
    _addressController.dispose();
    super.dispose();
  }

  Future<void> _getCurrentLocation() async {
    setState(() => _isLoading = true);

    final snapshot =
        await LocationService.instance.getCurrentLocationWithAddress();
    if (!mounted) {
      return;
    }

    if (snapshot == null) {
      _showMessage('Não foi possível obter a localização atual', Colors.red);
      setState(() => _isLoading = false);
      return;
    }

    setState(() {
      _latitude = snapshot.latitude;
      _longitude = snapshot.longitude;
      _address = snapshot.address;
      _addressController.text = snapshot.address ?? '';
      _isLoading = false;
    });

    widget.onLocationSelected(
      snapshot.latitude,
      snapshot.longitude,
      snapshot.address,
    );
    _showMessage('Localização obtida com sucesso', Colors.green);
  }

  Future<void> _searchAddress() async {
    final query = _addressController.text.trim();
    if (query.isEmpty) {
      return;
    }

    setState(() => _isLoading = true);
    final position =
        await LocationService.instance.getPositionFromAddress(query);
    if (!mounted) {
      return;
    }

    if (position == null) {
      _showMessage('Endereço não encontrado', Colors.orange);
      setState(() => _isLoading = false);
      return;
    }

    setState(() {
      _latitude = position.latitude;
      _longitude = position.longitude;
      _address = query;
      _isLoading = false;
    });

    widget.onLocationSelected(position.latitude, position.longitude, query);
    _showMessage('Endereço localizado!', Colors.green);
  }

  void _showMessage(String text, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(text), backgroundColor: color),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          bottom: MediaQuery.of(context).viewInsets.bottom + 16,
          top: 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Icon(Icons.location_on_outlined),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text(
                    'Selecionar localização',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _addressController,
              enabled: !_isLoading,
              decoration: InputDecoration(
                labelText: 'Buscar endereço',
                hintText: 'Ex: Av. Afonso Pena, 1000, Belo Horizonte',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(
                  onPressed: _isLoading ? null : _searchAddress,
                  icon: const Icon(Icons.send),
                ),
              ),
              onSubmitted: (_) => _searchAddress(),
            ),
            const SizedBox(height: 16),
            const Row(
              children: [
                Expanded(child: Divider()),
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: 12),
                  child: Text('ou'),
                ),
                Expanded(child: Divider()),
              ],
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _isLoading ? null : _getCurrentLocation,
              icon: _isLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.my_location),
              label: Text(_isLoading
                  ? 'Obtendo localização...'
                  : 'Usar localização atual'),
              style:
                  ElevatedButton.styleFrom(padding: const EdgeInsets.all(16)),
            ),
            if (_latitude != null && _longitude != null) ...[
              const SizedBox(height: 16),
              Card(
                color: Colors.blueGrey.shade50,
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.check_circle, color: Colors.blueGrey),
                          SizedBox(width: 8),
                          Text(
                            'Localização selecionada',
                            style: TextStyle(fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      if (_address != null && _address!.isNotEmpty)
                        Text(_address!),
                      Text(
                        LocationService.instance
                            .formatCoordinates(_latitude!, _longitude!),
                        style: TextStyle(color: Colors.grey.shade600),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

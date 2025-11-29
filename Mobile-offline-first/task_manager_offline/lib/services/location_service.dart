import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';

/// Serviço de localização que encapsula permissões, leitura de GPS e
/// geocodificação reversa/forward.
class LocationService {
  LocationService._();

  static final LocationService instance = LocationService._();

  Future<bool> _ensurePermission() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return false;

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      return false;
    }

    return true;
  }

  Future<Position?> getCurrentPosition() async {
    final ok = await _ensurePermission();
    if (!ok) return null;

    try {
      return await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high);
    } catch (_) {
      return null;
    }
  }

  double distanceBetween(
    double startLatitude,
    double startLongitude,
    double endLatitude,
    double endLongitude,
  ) {
    return Geolocator.distanceBetween(
        startLatitude, startLongitude, endLatitude, endLongitude);
  }

  String formatCoordinates(double latitude, double longitude) {
    return '${latitude.toStringAsFixed(5)}, ${longitude.toStringAsFixed(5)}';
  }

  Future<String?> getAddressFromCoordinates(
      double latitude, double longitude) async {
    try {
      final placemarks = await placemarkFromCoordinates(latitude, longitude);
      if (placemarks.isEmpty) return null;
      final place = placemarks.first;
      final parts = <String?>[
        place.street,
        place.subLocality,
        place.locality,
        place.administrativeArea
      ].where((p) => p != null && p.trim().isNotEmpty).toList();
      return parts.isEmpty ? null : parts.take(3).join(', ');
    } catch (_) {
      return null;
    }
  }

  Future<Position?> getPositionFromAddress(String address) async {
    try {
      final locations = await locationFromAddress(address);
      if (locations.isEmpty) return null;
      final loc = locations.first;
      return Position(
        latitude: loc.latitude,
        longitude: loc.longitude,
        timestamp: DateTime.now(),
        accuracy: 0,
        altitude: 0,
        heading: 0,
        speed: 0,
        speedAccuracy: 0,
        altitudeAccuracy: 0,
        headingAccuracy: 0,
      );
    } catch (_) {
      return null;
    }
  }

  Future<LocationSnapshot?> getCurrentLocationWithAddress() async {
    final pos = await getCurrentPosition();
    if (pos == null) return null;
    final address =
        await getAddressFromCoordinates(pos.latitude, pos.longitude);
    return LocationSnapshot(
        latitude: pos.latitude, longitude: pos.longitude, address: address);
  }
}

class LocationSnapshot {
  const LocationSnapshot(
      {required this.latitude, required this.longitude, this.address});

  final double latitude;
  final double longitude;
  final String? address;
}

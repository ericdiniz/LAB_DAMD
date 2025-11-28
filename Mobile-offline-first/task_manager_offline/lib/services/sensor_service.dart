import 'dart:async';
import 'dart:math' as math;

import 'package:sensors_plus/sensors_plus.dart';
import 'package:vibration/vibration.dart';

class SensorService {
  static final SensorService instance = SensorService._init();
  SensorService._init();

  StreamSubscription<AccelerometerEvent>? _sub;
  void Function()? _onShake;
  bool _active = false;

  static const double _shakeThreshold = 15.0;
  static const Duration _shakeCooldown = Duration(milliseconds: 500);
  DateTime? _lastShake;

  void startShakeDetection(void Function() onShake) {
    if (_active) return;
    _onShake = onShake;
    _sub = accelerometerEvents.listen(_handle);
    _active = true;
  }

  void _handle(AccelerometerEvent e) {
    final now = DateTime.now();
    if (_lastShake != null && now.difference(_lastShake!) < _shakeCooldown) {
      return;
    }
    final mag = math.sqrt(e.x * e.x + e.y * e.y + e.z * e.z);
    if (mag > _shakeThreshold) {
      _lastShake = now;
      try {
        Vibration.hasVibrator().then((has) {
          if (has == true) Vibration.vibrate(duration: 100);
        });
      } catch (_) {}
      _onShake?.call();
    }
  }

  void stop() {
    _sub?.cancel();
    _sub = null;
    _onShake = null;
    _active = false;
  }
}
import 'dart:async';
import 'dart:math' as math;

import 'package:sensors_plus/sensors_plus.dart';
import 'package:vibration/vibration.dart';

/// Handles accelerometer readings to detect "shake" gestures.
class SensorService {
  SensorService._();

  static final SensorService instance = SensorService._();

  StreamSubscription<AccelerometerEvent>? _subscription;
  void Function()? _onShake;

  static const double _shakeThreshold = 15.0;
  static const Duration _cooldown = Duration(milliseconds: 600);

  DateTime? _lastShake;
  bool _isActive = false;

  bool get isActive => _isActive;

  /// Starts listening for shake gestures. Subsequent calls while active are ignored.
  void startShakeDetection(void Function() onShake) {
    if (_isActive) {
      return;
    }

    _onShake = onShake;
    _isActive = true;

    _subscription = accelerometerEventStream().listen(
      _handleAccelerometerEvent,
      onError: (error, __) {
        // If the stream errors we stop listening to avoid resource leaks.
        stop();
      },
    );
  }

  void _handleAccelerometerEvent(AccelerometerEvent event) {
    final now = DateTime.now();

    if (_lastShake != null && now.difference(_lastShake!) < _cooldown) {
      return;
    }

    final magnitude = math.sqrt(
      event.x * event.x + event.y * event.y + event.z * event.z,
    );

    if (magnitude < _shakeThreshold) {
      return;
    }

    _lastShake = now;
    _triggerFeedback();
    _onShake?.call();
  }

  Future<void> _triggerFeedback() async {
    try {
      final hasVibrator = await Vibration.hasVibrator() ?? false;
      if (hasVibrator) {
        await Vibration.vibrate(duration: 120);
      }
    } catch (_) {
      // Devices without vibration support or permission issues can be safely ignored.
    }
  }

  /// Stops listening to the accelerometer stream.
  void stop() {
    _subscription?.cancel();
    _subscription = null;
    _onShake = null;
    _isActive = false;
  }
}

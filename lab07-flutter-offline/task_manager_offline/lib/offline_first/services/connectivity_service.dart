import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';

/// Serviço de monitoramento de conectividade de rede
class ConnectivityService {
  ConnectivityService._();

  static final ConnectivityService instance = ConnectivityService._();

  final Connectivity _connectivity = Connectivity();
  final _connectivityController = StreamController<bool>.broadcast();

  bool _isOnline = false;
  StreamSubscription<ConnectivityResult>? _subscription;

  Stream<bool> get connectivityStream => _connectivityController.stream;
  bool get isOnline => _isOnline;

  Future<void> initialize() async {
    final result = await _connectivity.checkConnectivity();
    _updateStatus(result);

    _subscription = _connectivity.onConnectivityChanged.listen(_updateStatus);
  }

  void _updateStatus(ConnectivityResult result) {
    final previous = _isOnline;
    _isOnline = result != ConnectivityResult.none;

    if (previous != _isOnline) {
      _connectivityController.add(_isOnline);
    }
  }

  Future<bool> checkConnectivity() async {
    final result = await _connectivity.checkConnectivity();
    _updateStatus(result);
    return _isOnline;
  }

  void dispose() {
    _subscription?.cancel();
    _connectivityController.close();
  }
}

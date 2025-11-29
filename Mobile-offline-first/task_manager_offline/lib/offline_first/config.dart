/// Configurações simples de runtime para desenvolvimento
class AppConfig {
  // Se true, o cliente vai pular o health-check do servidor e tentar sincronizar
  // diretamente. Use apenas em ambiente de desenvolvimento/local.
  static bool devSkipHealthCheck = true;
}

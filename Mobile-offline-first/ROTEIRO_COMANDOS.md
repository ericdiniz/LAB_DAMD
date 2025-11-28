# Roteiro de Comandos — Mobile-offline-first

Este roteiro garante que você conseguirá rodar o app Flutter a partir da nova pasta clonada/copiada.

---

## 1. Instalar dependências do Flutter

Abra o terminal e execute:

```bash
cd /Users/ericdiniz/Documents/GitHub/LAB_DAMD/Mobile-offline-first/task_manager_offline
flutter pub get
```

---

## 2. Limpar build antigo (opcional, mas recomendado)

```bash
flutter clean
```

---

## 3. Rodar o app no emulador/dispositivo

Troque o `--device-id` pelo seu, se necessário:

```bash
bash -lc 'cd /Users/ericdiniz/Documents/GitHub/LAB_DAMD/Mobile-offline-first/task_manager_offline && flutter run --debug --device-id 569BE8C9-03EB-491B-869E-E254EAA73CF5'
```

---

## 4. (Opcional) Atualizar dependências

Se quiser garantir que tudo está atualizado:

```bash
flutter pub upgrade
```

---

## 5. (Opcional) Verificar dispositivos disponíveis

```bash
flutter devices
```

---

## 6. (Opcional) Rodar testes unitários

```bash
flutter test
```

---

Pronto! O app está pronto para ser executado e modificado na nova estrutura.

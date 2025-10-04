import 'package:flutter/material.dart';

void main() {
  runApp(const MeuApp());
}

class MeuApp extends StatelessWidget {
  const MeuApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Lista de Compras',
      theme: ThemeData(primarySwatch: Colors.blue, useMaterial3: true),
      home: const PaginaInicial(),
    );
  }
}

class PaginaInicial extends StatefulWidget {
  const PaginaInicial({super.key});

  @override
  State<PaginaInicial> createState() => _PaginaInicialState();
}

class _PaginaInicialState extends State<PaginaInicial> {
  // Lista de itens de compra com status de comprado
  List<_ItemCompra> itensCompra = [];
  // Controlador do campo de texto
  TextEditingController controladorTexto = TextEditingController();

  @override
  Widget build(BuildContext context) {
    int totalComprados = itensCompra.where((item) => item.comprado).length;
    int totalNaoComprados = itensCompra.where((item) => !item.comprado).length;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Minha Lista de Compras'),
        backgroundColor: Colors.blue,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.delete_sweep),
            tooltip: 'Limpar Lista',
            onPressed: itensCompra.isEmpty ? null : _confirmarLimparLista,
          ),
        ],
      ),
      body: Column(
        children: [
          // Área para adicionar novos itens
          Container(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: controladorTexto,
                    decoration: const InputDecoration(
                      hintText: 'Digite um item...',
                      border: OutlineInputBorder(),
                    ),
                    onSubmitted: (texto) => adicionarItem(),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: adicionarItem,
                  child: const Text('Adicionar'),
                ),
              ],
            ),
          ),
          // Estatísticas
          Padding(
            padding: const EdgeInsets.only(bottom: 8.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Chip(
                  label: Text('Total: ${itensCompra.length}'),
                  backgroundColor: Colors.blue.shade50,
                ),
                const SizedBox(width: 8),
                Chip(
                  label: Text('Comprados: $totalComprados'),
                  backgroundColor: Colors.green.shade50,
                ),
                const SizedBox(width: 8),
                Chip(
                  label: Text('Pendentes: $totalNaoComprados'),
                  backgroundColor: Colors.orange.shade50,
                ),
              ],
            ),
          ),
          // Lista de itens
          Expanded(
            child: itensCompra.isEmpty
                ? const Center(
                    child: Text(
                      'Sua lista está vazia!\nAdicione o primeiro item.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 16, color: Colors.grey),
                    ),
                  )
                : ListView.builder(
                    itemCount: itensCompra.length,
                    itemBuilder: (context, indice) {
                      final item = itensCompra[indice];
                      return Card(
                        margin: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 4,
                        ),
                        child: ListTile(
                          leading: Checkbox(
                            value: item.comprado,
                            onChanged: (valor) {
                              setState(() {
                                item.comprado = valor ?? false;
                              });
                              if (item.comprado) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(
                                      'Item "${item.nome}" marcado como comprado!',
                                    ),
                                    duration: const Duration(seconds: 1),
                                  ),
                                );
                              }
                            },
                          ),
                          title: Text(
                            item.nome,
                            style: TextStyle(
                              decoration: item.comprado
                                  ? TextDecoration.lineThrough
                                  : null,
                              color: item.comprado ? Colors.grey : Colors.black,
                            ),
                          ),
                          trailing: IconButton(
                            icon: const Icon(Icons.delete, color: Colors.red),
                            onPressed: () => _confirmarRemoverItem(indice),
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
      // Informação na parte inferior
      bottomNavigationBar: Container(
        padding: const EdgeInsets.all(16),
        child: Text(
          'Total de itens: ${itensCompra.length}  |  Comprados: $totalComprados',
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }

  void adicionarItem() {
    String novoItem = controladorTexto.text.trim();
    if (novoItem.isEmpty) return;
    if (itensCompra.any(
      (item) => item.nome.toLowerCase() == novoItem.toLowerCase(),
    )) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Este item já está na lista!'),
          duration: Duration(seconds: 2),
        ),
      );
      return;
    }
    setState(() {
      itensCompra.add(_ItemCompra(novoItem));
      controladorTexto.clear();
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Item "$novoItem" adicionado!'),
        duration: const Duration(seconds: 1),
      ),
    );
  }

  void _confirmarRemoverItem(int indice) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Remover item'),
        content: Text(
          'Tem certeza que deseja remover "${itensCompra[indice].nome}" da lista?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              removerItem(indice);
            },
            child: const Text('Remover', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  void removerItem(int indice) {
    String nomeRemovido = itensCompra[indice].nome;
    setState(() {
      itensCompra.removeAt(indice);
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Item "$nomeRemovido" removido!'),
        duration: const Duration(seconds: 1),
      ),
    );
  }

  void _confirmarLimparLista() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Limpar lista'),
        content: const Text('Tem certeza que deseja remover todos os itens?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              _limparLista();
            },
            child: const Text('Limpar', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  void _limparLista() {
    setState(() {
      itensCompra.clear();
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Lista de compras limpa!'),
        duration: Duration(seconds: 1),
      ),
    );
  }

  @override
  void dispose() {
    controladorTexto.dispose();
    super.dispose();
  }
}

class _ItemCompra {
  final String nome;
  bool comprado;
  _ItemCompra(this.nome, {this.comprado = false});
}

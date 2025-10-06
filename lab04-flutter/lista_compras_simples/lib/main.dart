import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

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
  final GlobalKey<AnimatedListState> _listKey = GlobalKey<AnimatedListState>();
  List<Map<String, dynamic>> itensCompra = [];
  TextEditingController controladorTexto = TextEditingController();
  TextEditingController controladorBusca = TextEditingController();
  String categoriaSelecionada = 'Frutas';
  String filtroCategoria = 'Todas';
  String filtroStatus = 'Todos';
  List<Map<String, dynamic>> itensFiltrados = [];
  Timer? _debounce;

  final List<String> categorias = ['Frutas', 'Limpeza', 'Bebidas', 'Outros'];
  final List<String> categoriasFiltro = [
    'Todas',
    'Frutas',
    'Limpeza',
    'Bebidas',
    'Outros',
  ];

  @override
  void initState() {
    super.initState();
    carregarLista();
    // Debounce manual para busca
    controladorBusca.addListener(() {
      if (_debounce?.isActive ?? false) _debounce?.cancel();
      _debounce = Timer(const Duration(milliseconds: 300), () {
        _filtrarItens();
      });
    });
  }

  Future<void> salvarLista() async {
    final prefs = await SharedPreferences.getInstance();
    // Salvar como JSON
    final String jsonString = jsonEncode(itensCompra);
    await prefs.setString('itensCompra', jsonString);
  }

  Future<void> carregarLista() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonString = prefs.getString('itensCompra');
    if (jsonString != null && jsonString.isNotEmpty) {
      try {
        final List<dynamic> decoded = jsonDecode(jsonString);
        final List<Map<String, dynamic>> itensCarregados = decoded
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        setState(() {
          itensCompra = itensCarregados;
          _filtrarItens();
        });
      } catch (e) {
        setState(() {
          itensCompra = [];
          _filtrarItens();
        });
      }
    }
  }

  void _filtrarItens() {
    final busca = controladorBusca.text.toLowerCase();
    setState(() {
      itensFiltrados = itensCompra.where((item) {
        final nome = item['nome'].toString().toLowerCase();
        final categoria = item['categoria'].toString();
        final comprado = item['comprado'] == true;
        final bool bateBusca = nome.contains(busca);
        final bool bateCategoria =
            filtroCategoria == 'Todas' || categoria == filtroCategoria;
        final bool bateStatus =
            filtroStatus == 'Todos' ||
            (filtroStatus == 'Comprados' && comprado) ||
            (filtroStatus == 'Pendentes' && !comprado);
        return bateBusca && bateCategoria && bateStatus;
      }).toList();
    });
  }

  void adicionarItem() {
    String novoItem = controladorTexto.text.trim();
    if (novoItem.isEmpty) return;

    bool existe = itensCompra.any(
      (item) =>
          item['nome'].toString().toLowerCase() == novoItem.toLowerCase() &&
          item['categoria'] == categoriaSelecionada,
    );
    if (existe) {
      _mostrarMensagem('Este item já está na sua lista!');
      return;
    }

    final novoMapa = {
      'nome': novoItem,
      'comprado': false,
      'categoria': categoriaSelecionada,
    };

    setState(() {
      itensCompra.add(novoMapa);
      _filtrarItens();
      controladorTexto.clear();
      // Animar inserção na lista filtrada
      final index = itensFiltrados.length - 1;
      _listKey.currentState?.insertItem(
        index,
        duration: const Duration(milliseconds: 400),
      );
    });
    salvarLista();
    _mostrarMensagem('Item "$novoItem" adicionado!');
  }

  void removerItem(int indiceFiltrado) {
    final itemRemovido = itensFiltrados[indiceFiltrado];
    final indiceOriginal = itensCompra.indexOf(itemRemovido);
    setState(() {
      itensCompra.removeAt(indiceOriginal);
      _filtrarItens();
      _listKey.currentState?.removeItem(
        indiceFiltrado,
        (context, animation) => FadeTransition(
          opacity: animation,
          child: SizeTransition(
            sizeFactor: animation,
            child: _construirItem(itemRemovido, indiceFiltrado, animation),
          ),
        ),
        duration: const Duration(milliseconds: 350),
      );
    });
    salvarLista();
    _mostrarMensagem('Item "${itemRemovido['nome']}" removido!');
  }

  void marcarComoComprado(int indiceFiltrado, bool comprado) {
    final item = itensFiltrados[indiceFiltrado];
    final indiceOriginal = itensCompra.indexOf(item);
    setState(() {
      itensCompra[indiceOriginal]['comprado'] = comprado;
      _filtrarItens();
    });
    salvarLista();
    String mensagem = comprado ? 'Item comprado!' : 'Item desmarcado!';
    _mostrarMensagem(mensagem);
  }

  void limparLista() {
    if (itensCompra.isEmpty) return;
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('Limpar Lista'),
          content: const Text('Tem certeza que deseja remover todos os itens?'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancelar'),
            ),
            TextButton(
              onPressed: () {
                setState(() {
                  itensCompra.clear();
                  _filtrarItens();
                });
                salvarLista();
                Navigator.of(context).pop();
                _mostrarMensagem('Lista limpa!');
              },
              child: const Text('Limpar', style: TextStyle(color: Colors.red)),
            ),
          ],
        );
      },
    );
  }

  void mostrarConfirmacaoRemocao(int indiceFiltrado) {
    final item = itensFiltrados[indiceFiltrado];
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('Remover Item'),
          content: Text('Remover "${item['nome']}" da lista?'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancelar'),
            ),
            TextButton(
              onPressed: () {
                removerItem(indiceFiltrado);
                Navigator.of(context).pop();
              },
              child: const Text('Remover', style: TextStyle(color: Colors.red)),
            ),
          ],
        );
      },
    );
  }

  void _mostrarMensagem(String mensagem) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(mensagem), duration: const Duration(seconds: 2)),
    );
  }

  Widget _construirItem(
    Map<String, dynamic> item,
    int indice,
    Animation<double>? animation,
  ) {
    final bool foiComprado = item['comprado'] as bool;
    final Color corFundo = foiComprado ? Colors.green[50]! : Colors.white;
    Widget conteudo = AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      color: corFundo,
      child: ListTile(
        leading: Checkbox(
          value: foiComprado,
          onChanged: (valor) => marcarComoComprado(indice, valor ?? false),
        ),
        title: Text(
          item['nome'],
          style: TextStyle(
            decoration: foiComprado ? TextDecoration.lineThrough : null,
            color: foiComprado ? Colors.grey : Colors.black,
            fontSize: 16,
          ),
        ),
        subtitle: Text(
          item['categoria'],
          style: const TextStyle(fontSize: 12, color: Colors.grey),
        ),
        trailing: Wrap(
          spacing: 8,
          children: [
            IconButton(
              icon: const Icon(Icons.edit, color: Colors.blue),
              onPressed: () => _editarItemDialog(item, indice),
            ),
            IconButton(
              icon: const Icon(Icons.delete, color: Colors.red),
              onPressed: () => mostrarConfirmacaoRemocao(indice),
            ),
          ],
        ),
      ),
    );
    if (animation != null) {
      return SizeTransition(sizeFactor: animation, child: conteudo);
    }
    return conteudo;
  }

  void _editarItemDialog(Map<String, dynamic> item, int indiceFiltrado) {
    final TextEditingController editarController = TextEditingController(
      text: item['nome'],
    );
    String categoriaAtual = item['categoria'] ?? categorias.first;
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Editar Item'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: editarController,
                decoration: const InputDecoration(labelText: 'Nome'),
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: categoriaAtual,
                items: categorias
                    .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                    .toList(),
                onChanged: (v) => categoriaAtual = v ?? categoriaAtual,
                decoration: const InputDecoration(labelText: 'Categoria'),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancelar'),
            ),
            TextButton(
              onPressed: () {
                final novoNome = editarController.text.trim();
                if (novoNome.isEmpty) return;
                final itemOriginal = itensFiltrados[indiceFiltrado];
                final idxOriginal = itensCompra.indexOf(itemOriginal);
                setState(() {
                  itensCompra[idxOriginal]['nome'] = novoNome;
                  itensCompra[idxOriginal]['categoria'] = categoriaAtual;
                  _filtrarItens();
                });
                salvarLista();
                Navigator.of(context).pop();
                _mostrarMensagem('Item atualizado');
              },
              child: const Text('Salvar'),
            ),
          ],
        );
      },
    );
  }

  Widget _criarEstatistica(
    String titulo,
    String valor,
    IconData icone,
    Color cor,
  ) {
    return Column(
      children: [
        Icon(icone, color: cor, size: 24),
        const SizedBox(height: 4),
        Text(
          valor,
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: cor,
          ),
        ),
        Text(titulo, style: const TextStyle(fontSize: 12, color: Colors.grey)),
      ],
    );
  }

  void compartilharLista() {
    if (itensCompra.isEmpty) {
      _mostrarMensagem('A lista está vazia para compartilhar.');
      return;
    }
    showModalBottomSheet(
      context: context,
      builder: (context) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.text_snippet),
                title: const Text('Compartilhar como texto'),
                onTap: () {
                  final StringBuffer buffer = StringBuffer();
                  for (var item in itensCompra) {
                    buffer.writeln('${item['nome']} (${item['categoria']})');
                  }
                  Share.share(
                    buffer.toString(),
                    subject: 'Minha Lista de Compras',
                  );
                  Navigator.of(context).pop();
                },
              ),
              ListTile(
                leading: const Icon(Icons.table_chart),
                title: const Text('Compartilhar como CSV'),
                onTap: () {
                  final StringBuffer csv = StringBuffer();
                  csv.writeln('nome,categoria,comprado');
                  for (var item in itensCompra) {
                    final nome = item['nome'].toString().replaceAll(',', '');
                    final categoria = item['categoria'].toString();
                    final comprado = item['comprado'] ? '1' : '0';
                    csv.writeln('$nome,$categoria,$comprado');
                  }
                  Share.share(
                    csv.toString(),
                    subject: 'Lista de Compras (CSV)',
                  );
                  Navigator.of(context).pop();
                },
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final total = itensCompra.length;
    final comprados = itensCompra
        .where((item) => item['comprado'] == true)
        .length;
    final restantes = total - comprados;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Minha Lista de Compras'),
        backgroundColor: Colors.blue,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.share),
            onPressed: compartilharLista,
            tooltip: 'Compartilhar lista',
          ),
          IconButton(
            icon: const Icon(Icons.clear_all),
            onPressed: limparLista,
            tooltip: 'Limpar lista',
          ),
        ],
      ),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16.0),
            decoration: BoxDecoration(
              color: Colors.grey[100],
              boxShadow: [
                BoxShadow(
                  color: Colors.grey.withOpacity(0.3),
                  spreadRadius: 1,
                  blurRadius: 3,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              children: [
                Expanded(
                  flex: 3,
                  child: TextField(
                    controller: controladorTexto,
                    decoration: const InputDecoration(
                      hintText: 'Digite um item para comprar...',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.add_shopping_cart),
                    ),
                    onSubmitted: (texto) => adicionarItem(),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 2,
                  child: DropdownButtonFormField<String>(
                    value: categoriaSelecionada,
                    items: categorias
                        .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                        .toList(),
                    onChanged: (valor) {
                      if (valor != null) {
                        setState(() {
                          categoriaSelecionada = valor;
                        });
                      }
                    },
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 14,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton.icon(
                  onPressed: adicionarItem,
                  icon: const Icon(Icons.add),
                  label: const Text('Adicionar'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blue,
                    foregroundColor: Colors.white,
                  ),
                ),
              ],
            ),
          ),
          if (itensCompra.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _criarEstatistica('Total', '$total', Icons.list, Colors.blue),
                  _criarEstatistica(
                    'Comprados',
                    '$comprados',
                    Icons.check_circle,
                    Colors.green,
                  ),
                  _criarEstatistica(
                    'Restantes',
                    '$restantes',
                    Icons.pending,
                    Colors.orange,
                  ),
                ],
              ),
            ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                Expanded(
                  flex: 3,
                  child: TextField(
                    controller: controladorBusca,
                    decoration: const InputDecoration(
                      labelText: 'Buscar itens',
                      prefixIcon: Icon(Icons.search),
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                const SizedBox(width: 12),
                Expanded(
                  flex: 1,
                  child: DropdownButtonFormField<String>(
                    value: filtroStatus,
                    items: ['Todos', 'Comprados', 'Pendentes']
                        .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                        .toList(),
                    onChanged: (valor) {
                      if (valor != null) {
                        setState(() {
                          filtroStatus = valor;
                          _filtrarItens();
                        });
                      }
                    },
                    decoration: const InputDecoration(
                      labelText: 'Status',
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 14,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 1,
                  child: DropdownButtonFormField<String>(
                    value: filtroCategoria,
                    items: categoriasFiltro
                        .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                        .toList(),
                    onChanged: (valor) {
                      if (valor != null) {
                        setState(() {
                          filtroCategoria = valor;
                          _filtrarItens();
                        });
                      }
                    },
                    decoration: const InputDecoration(
                      labelText: 'Categoria',
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 14,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: itensFiltrados.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.shopping_cart_outlined,
                          size: 64,
                          color: Colors.grey[400],
                        ),
                        const SizedBox(height: 16),
                        const Text(
                          'Sua lista está vazia!',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const Text(
                          'Adicione itens para começar suas compras',
                          style: TextStyle(fontSize: 16, color: Colors.grey),
                        ),
                      ],
                    ),
                  )
                : AnimatedList(
                    key: _listKey,
                    initialItemCount: itensFiltrados.length,
                    padding: const EdgeInsets.all(8),
                    itemBuilder: (context, indice, animation) {
                      final item = itensFiltrados[indice];
                      return _construirItem(item, indice, animation);
                    },
                  ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    controladorTexto.dispose();
    controladorBusca.dispose();
    super.dispose();
  }
}

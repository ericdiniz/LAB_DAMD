const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

class ProtoLoader {
  constructor(baseDir = path.join(__dirname, '../../protos')) {
    this.baseDir = baseDir;
  }

  loadProto(fileName, packageName) {
    const protoPath = path.join(this.baseDir, fileName);
    const pkgDef = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: false,
      oneofs: true
    });
    const descriptor = grpc.loadPackageDefinition(pkgDef);
    return packageName ? descriptor[packageName] : descriptor;
  }

  // helpers para enums string<->int, se precisar
  static toEnum(value, EnumObj) {
    if (typeof value === 'string') return EnumObj[value] ?? undefined;
    return value;
  }
}
module.exports = ProtoLoader;

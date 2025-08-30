const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

class ProtoLoader {
  constructor() {
    this.services = new Map();
  }
  loadProto(protoFile, packageName) {
    const PROTO_PATH = path.join(__dirname, '..', '..', 'proto', protoFile);
    const def = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
    });
    const desc = grpc.loadPackageDefinition(def);
    this.services.set(packageName, desc[packageName]);
    return desc[packageName];
  }
  getService(packageName) { return this.services.get(packageName); }

  static convertTimestamp(date) { return Math.floor(new Date(date).getTime()/1000); }
  static convertFromTimestamp(ts) { return new Date(parseInt(ts)*1000); }
  static convertPriority(p) { return ({low:0, medium:1, high:2, urgent:3}[p] ?? 1); }
  static convertFromPriority(v) { return (['low','medium','high','urgent'][v] ?? 'medium'); }
}

module.exports = ProtoLoader;

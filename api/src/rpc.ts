import { Server, ServerCredentials, loadPackageDefinition } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { resolve } from 'path';
import { getPokemonRepository } from '@pokemon/repositories';
import { setupSequelize } from '@pokemon/utils/db';

const { RPC_PORT = '8082' } = process.env;

async function startServer() {
  await setupSequelize();

  const definition = loadSync(resolve(__dirname, 'protos/pokeshop.proto'), {
    defaults: true,
    keepCase: false,
    longs: Number,
    enums: String,
  });
  const descriptor = loadPackageDefinition(definition) as any;
  const repository = getPokemonRepository();
  const server = new Server();

  server.addService(descriptor.pokeshop.Pokeshop.service, {
    getPokemonList: async (call, callback) => {
      try {
        const { skip = 0, take = 20 } = call.request;
        const [items, totalCount] = await Promise.all([
          repository.findMany({ skip, take }),
          repository.count(),
        ]);
        const response = { items, totalCount };
        callback(null, response);
      } catch (error) {
        callback(error);
      }
    },
  });

  server.bindAsync(`0.0.0.0:${RPC_PORT}`, ServerCredentials.createInsecure(), error => {
    if (error) throw error;
    console.log(`Starting gRPC server on port ${RPC_PORT}`);
  });
}

startServer();

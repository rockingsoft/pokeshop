import { context, propagation, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';
import { Server, ServerCredentials, loadPackageDefinition } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { resolve } from 'path';
import { getPokemonRepository } from '@pokemon/repositories';
import { createSpanFromContext, runWithSpan } from '@pokemon/telemetry/tracing';
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
      const parentContext = propagation.extract(context.active(), call.metadata.getMap());
      const span = await createSpanFromContext('pokeshop.Pokeshop/GetPokemonList', parentContext, {
        kind: SpanKind.SERVER,
      });

      try {
        const response = await runWithSpan(span, async () => {
          const { skip = 0, take = 20 } = call.request;
          const [items, totalCount] = await Promise.all([
            repository.findMany({ skip, take }),
            repository.count(),
          ]);
          return { items, totalCount };
        });
        callback(null, response);
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        callback(error);
      } finally {
        span.setAttributes({
          [SemanticAttributes.RPC_SYSTEM]: 'grpc',
          [SemanticAttributes.RPC_SERVICE]: 'pokeshop.Pokeshop',
          [SemanticAttributes.RPC_METHOD]: 'GetPokemonList',
        });
        span.end();
      }
    },
  });

  server.bindAsync(`0.0.0.0:${RPC_PORT}`, ServerCredentials.createInsecure(), error => {
    if (error) throw error;
    console.log(`Starting gRPC server on port ${RPC_PORT}`);
  });
}

startServer();

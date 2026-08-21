import { getPokemonRepository } from '@pokemon/repositories';

const sleep = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

function startStream(ctx) {
  ctx.req.setTimeout(0);
  ctx.status = 200;
  ctx.set('Content-Type', 'text/event-stream');
  ctx.set('Cache-Control', 'no-cache, no-transform');
  ctx.set('Connection', 'keep-alive');
  ctx.set('X-Accel-Buffering', 'no');
  ctx.respond = false;
  ctx.res.flushHeaders();

  let closed = false;
  ctx.res.on('close', () => {
    closed = true;
  });

  return {
    isClosed: () => closed,
    send(event: string, data: unknown) {
      if (!closed) ctx.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    close() {
      if (!closed) ctx.res.end();
    },
  };
}

export default function setupRoute(router) {
  router.get('/events/pokemon/:pokemonId', async ctx => {
    const pokemonId = Number(ctx.params.pokemonId);
    const pokemonName = typeof ctx.query.name === 'string' ? ctx.query.name.toLowerCase() : '';
    if (!Number.isInteger(pokemonId) || pokemonId <= 0) {
      ctx.status = 400;
      ctx.body = { error: 'invalid Pokemon ID' };
      return;
    }

    const stream = startStream(ctx);
    const repository = getPokemonRepository();

    for (let attempt = 0; attempt < 20 && !stream.isClosed(); attempt += 1) {
      const pokemon = pokemonName
        ? (await repository.findMany({ where: { name: pokemonName }, take: 1 }))[0]
        : await repository.findOne(pokemonId);
      if (pokemon) {
        stream.send('created', pokemon);
        stream.close();
        return;
      }
      await sleep(500);
    }

    stream.send('timeout', { pokemonId });
    stream.close();
  });
}

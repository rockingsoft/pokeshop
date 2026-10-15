import Router from '@koa/router';

export default function setupRoute(router: Router) {
  router.get('/pokemon/slow', async ctx => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    ctx.status = 200;
    ctx.body = { ok: true };
  });
}

import Koa from 'koa';
import Router from '@koa/router';
import KoaLogger from 'koa-logger';
import bodyParser from 'koa-bodyparser';
import cors from '@koa/cors';
import createHandler from '@pokemon/handlers/create.handler';
import getHandler from '@pokemon/handlers/get.handler';
import importHandler from '@pokemon/handlers/import.handler';
import healthcheckHandler from '@pokemon/handlers/healthcheck.handler';
import traceSummaryHandler from '@pokemon/handlers/traceSummary.handler';
import eventsHandler from '@pokemon/handlers/events.handler';
import { setupSequelize } from '@pokemon/utils/db';
import { instrumentRoute } from '@pokemon/middlewares/instrumentation';

const { APP_PORT = 8081 } = process.env;

async function startApp() {
  const app = new Koa();
  const router = new Router();

  await setupSequelize();

  const routeSetupFunctions = [
    healthcheckHandler,
    createHandler,
    getHandler,
    importHandler,
    traceSummaryHandler,
    eventsHandler,
  ];

  for (const routeSetup of routeSetupFunctions) {
    routeSetup(router);
  }

  app
    .use(cors({ exposeHeaders: ['X-Trace-Id', 'X-Span-Id'] }))
    .use(instrumentRoute())
    .use(bodyParser())
    .use(KoaLogger())
    .use(router.routes())
    .use(router.allowedMethods());

  console.log(`Starting server on port ${APP_PORT}`);
  app.listen(APP_PORT);
}

startApp();

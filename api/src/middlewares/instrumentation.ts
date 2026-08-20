import Koa from 'koa';
import { snakeCase } from 'lodash';
import { context, propagation, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';
import { createSpanFromContext, runWithSpan } from '@pokemon/telemetry/tracing';
import { CustomTags } from '../constants/Tags';

const instrumentRoute = () => {
  return async (ctx: Koa.BaseContext, next) => {
    if (ctx.path.startsWith('/traces/')) {
      return next();
    }

    const { method, ip, url: route, headers, body, host, protocol, query } = ctx;
    const isFixed = query.isFixed === 'true';

    const carrier = { ...headers };
    if (typeof query.traceparent === 'string') {
      carrier.traceparent = query.traceparent;
    }
    const parentContext = propagation.extract(context.active(), carrier);
    console.log('@@>> Requesting method', method, route, headers);
    const span = await createSpanFromContext(`${method} ${route}`, parentContext, { kind: SpanKind.SERVER });

    try {
      return await runWithSpan(span, async () => next(ctx));
    } catch (ex) {
      span.recordException(ex);
      span.setStatus({ code: SpanStatusCode.ERROR });
      ctx.status = 400;
    } finally {
      if (!ctx.headerSent) {
        ctx.set('X-Trace-Id', span.spanContext().traceId);
        ctx.set('X-Span-Id', span.spanContext().spanId);
      }
      Object.entries(headers).forEach(([key, value]) => {
        span.setAttribute(`${CustomTags.HTTP_REQUEST_HEADER}.${snakeCase(key)}`, JSON.stringify([value]));
      });

      span.setAttributes({
        [SemanticAttributes.HTTP_STATUS_CODE]: ctx.status,
        [CustomTags.HTTP_RESPONSE_BODY]: JSON.stringify(ctx.body),
        [CustomTags.HTTP_REQUEST_BODY]: JSON.stringify(body),

        [SemanticAttributes.HTTP_ROUTE]: route,
        [SemanticAttributes.HTTP_CLIENT_IP]: ip,
        [SemanticAttributes.HTTP_METHOD]: method,
        [SemanticAttributes.HTTP_HOST]: host,
        [SemanticAttributes.HTTP_USER_AGENT]: headers['user-agent'] || '',

        ...(isFixed
          ? {
              [SemanticAttributes.NET_HOST_NAME]: host,
              [SemanticAttributes.HTTP_TARGET]: route,
              [SemanticAttributes.HTTP_SCHEME]: 'https',
            }
          : {
              [SemanticAttributes.HTTP_SCHEME]: protocol,
            }),
      });

      span.end();
    }
  };
};

export { instrumentRoute };

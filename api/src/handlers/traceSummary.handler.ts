import fetch from 'node-fetch';

const { JAEGER_QUERY_URL = 'http://jaeger:16686' } = process.env;

function tagValue(span, key) {
  return span.tags?.find(tag => tag.key === key)?.value;
}

export function summarize(trace) {
  const processServices = Object.fromEntries(
    Object.entries(trace.processes || {}).map(([id, process]: [string, any]) => [id, process.serviceName])
  );
  const orderedSpans = [...trace.spans].sort((a, b) => {
    const rootOrder = (a.references?.length || 0) - (b.references?.length || 0);
    return rootOrder || a.startTime - b.startTime;
  });
  const startedAt = Math.min(...orderedSpans.map(span => span.startTime));
  const finishedAt = Math.max(...orderedSpans.map(span => span.startTime + span.duration));

  const spans = orderedSpans.map(span => ({
    spanId: span.spanID,
    parentSpanId: span.references?.[0]?.spanID || null,
    operationName: span.operationName,
    service: processServices[span.processID] || 'Pokeshop',
    durationMs: Math.max(0.1, span.duration / 1000),
    status: tagValue(span, 'error') === true || tagValue(span, 'otel.status_code') === 'ERROR' ? 'error' : 'ok',
  }));

  return {
    ready: true,
    traceId: trace.traceID,
    durationMs: Math.max(0.1, (finishedAt - startedAt) / 1000),
    services: [...new Set(spans.map(span => span.service))],
    status: spans.some(span => span.status === 'error') ? 'error' : 'ok',
    spans,
  };
}

export async function getTraceSummary(traceId: string) {
  const response = await fetch(`${JAEGER_QUERY_URL}/api/traces/${traceId}`);
  if (!response.ok) return null;
  const payload = (await response.json()) as any;
  const trace = payload.data?.[0];
  return trace?.spans?.length ? summarize(trace) : null;
}

export default function setupRoute(router) {
  router.get('/traces/:traceId/summary', async ctx => {
    const { traceId } = ctx.params;
    if (!/^[a-f0-9]{32}$/i.test(traceId)) {
      ctx.status = 400;
      ctx.body = { error: 'invalid trace ID' };
      return;
    }

    const summary = await getTraceSummary(traceId);
    if (!summary) {
      ctx.status = 202;
      ctx.body = { ready: false };
      return;
    }
    ctx.body = summary;
  });
}

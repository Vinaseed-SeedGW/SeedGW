import type { Instrumentation } from 'next';
import 'server-only';
import { recordError } from '@seedgw/db/error-log';

type Args = Parameters<Instrumentation.onRequestError>;

export async function reportRequestError(error: Args[0], request: Args[1], context: Args[2]) {
  await recordError({
    source: 'WEB_SERVER',
    error,
    path: request.path.split('?')[0] ?? request.path,
    context: {
      kind: context.routeType,
      route: context.routePath,
      method: request.method,
      digest:
        typeof error === 'object' && error !== null && 'digest' in error
          ? String(error.digest)
          : null,
    },
  });
}

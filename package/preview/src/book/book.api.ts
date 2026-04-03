import {coreInstance} from '../core';

import {bookParamsSchema} from '@rezics/contract';
import type {BookDTO} from '@rezics/contract';

import {bookService} from '@rezics/server/book/book.service';
import {mapBookToDTO} from '@rezics/server/book/mapper';

import React from 'react';
import {renderToReadableStream} from 'react-dom/server';
import {BookShareDocument} from '../component/BookShareDocument';
import {withDoctype} from '../utils/htmlStream';

// 之后全部走 MeiliSearch API，不要走 prisma，太慢了

function getRequestOrigin(request: Request): string {
  const xfProto = request.headers.get('x-forwarded-proto');
  const xfHost = request.headers.get('x-forwarded-host');
  const host = xfHost ?? request.headers.get('host');

  if (host) {
    const proto = xfProto ?? 'http';
    return `${proto}://${host}`;
  }

  // Fallback: Bun Request.url is typically absolute.
  try {
    return new URL(request.url).origin;
  } catch {
    return 'http://localhost';
  }
}

function toAbsolute(url: string, origin: string): string {
  try {
    return new URL(url).toString();
  } catch {
    return new URL(url, origin).toString();
  }
}

async function renderBookSharePage(opts: {
  book: BookDTO;
  canonicalUrl: string;
  origin: string;
}): Promise<Response> {
  const element = React.createElement(BookShareDocument, {
    book: opts.book,
    canonicalUrl: opts.canonicalUrl,
    origin: opts.origin,
  });

  const stream = (await renderToReadableStream(
    element,
  )) as ReadableStream<Uint8Array> & {
    allReady?: Promise<void>;
  };

  // Ensure <head> is fully flushed before sending to bots.
  // (harmless even without Suspense)
  if (stream.allReady) await stream.allReady;

  return new Response(withDoctype(stream), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Share pages are frequently re-fetched by bots; keep this short.
      'cache-control': 'public, max-age=60',
      'x-robots-tag': 'all',
    },
  });
}

/**
 * Shareable HTML page (bots can parse OG/Twitter meta).
 */
export const bookApi = coreInstance('/book')
  /**
   * GET /book/:unitId
   */
  .get(
    '/:unitId',
    async ({params, request, set}): Promise<Response> => {
      try {
        const origin = getRequestOrigin(request);
        const canonicalUrl = toAbsolute(`/book/${params.unitId}`, origin);
        const book = await bookService.getByUnitId(params.unitId);
        const dto = mapBookToDTO(book as any);
        return await renderBookSharePage({book: dto, canonicalUrl, origin});
      } catch {
        set.status = 404;
        return new Response(
          '<!doctype html><title>Not Found</title>Not Found',
          {
            status: 404,
            headers: {'content-type': 'text/html; charset=utf-8'},
          },
        );
      }
    },
    {
      params: bookParamsSchema,
      detail: {
        summary: 'Book share page',
        description:
          'Bot-friendly HTML page with OpenGraph/Twitter meta for sharing',
        tags: ['Books'],
      },
    },
  );

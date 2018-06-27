/*tslint:disable:max-classes-per-file*/

/**
 * This is a low level module:
 * it uses the standard Web API Fetch function (`fetch()`) in order to make a request to a resource
 * and wraps it in a `Task<Either>` monad.
 *
 * So, you can:
 * - use the standard, clean and widely supported api to make XHR;
 * - "project" it into a declarative functional world where execution is lazy (`Task`);
 * - handle "by design" the possibility of a failure with an explicit channel for errors (`Either`).
 *
 * The module tries to be as more compliant as possible with the `fetch()` interface but with subtle differences:
 * - request `method` is always explicit (no implicit 'GET');
 * - accepted methods are definened by the `Method` union type;
 * - `fetch`'s input is always a `USVString` (no `Request` objects allowed);
 * - `Response` is mapped into a specific `AppyResponse<mixed>` interface where `mixed` is taken from `io-ts` lib;
 * - `AppyResponse` `headers` property is always a `HeadersMap` (alias for a map of string);
 * - `AppyResponse` has a `body` property that is the result of parsing to JSON the string returned from `response.text()`; if it cannot be parsed as JSON, `body` value is just the string (both types of data are covered by the `mixed` type).
 *
 * `RequestInit` configuration object instead remains the same.
 *
 * References:
 * - https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
 * - https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch
 * - https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
 * - https://developer.mozilla.org/en-US/docs/Web/API/USVString
 * - https://developer.mozilla.org/en-US/docs/Web/API/Request
 * - https://gcanti.github.io/fp-ts/Task.html
 * - https://gcanti.github.io/fp-ts/Either.html
 * - https://gcanti.github.io/io-ts
 *
 * @module request
 */

import {Either, left, right} from 'fp-ts/lib/Either';
import {Task} from 'fp-ts/lib/Task';
import {mixed} from 'io-ts';

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

export interface HeadersMap {
  [k: string]: string;
}

export interface AppyRequest {
  (m: Method, u: USVString, o?: RequestInit): AppyTask;
}

export interface AppyRequestNoMethod {
  (u: USVString, o?: RequestInit): AppyTask;
}

export type AppyTask = Task<Either<AppyError, AppyResponse<mixed>>>;

export interface AppyResponse<A> {
  headers: HeadersMap;
  status: number;
  statusText: string;
  url: string;
  body: A;
}

export type AppyError = NetworkError | BadUrl | BadResponse;

export class NetworkError {
  public readonly type: 'NetworkError' = 'NetworkError';
  constructor(readonly message: string, readonly uri: USVString) {}
}

export class BadUrl {
  public readonly type: 'BadUrl' = 'BadUrl';
  constructor(readonly url: string, readonly response: AppyResponse<mixed>) {}
}

export class BadResponse {
  public readonly type: 'BadResponse' = 'BadResponse';
  constructor(readonly response: AppyResponse<mixed>) {}
}

const toHeadersMap = (hs: Headers): HeadersMap => {
  const result: HeadersMap = {};

  hs.forEach((v: string, k: string) => {
    result[k] = v;
  });

  return result;
};

const parseBody = (a: string): mixed => {
  try {
    return JSON.parse(a);
  } catch (e) {
    return a;
  }
};

export const request: AppyRequest = (method, uri, options) =>
  new Task(() =>
    fetch(uri, {...options, method})
      .then(
        resp =>
          resp
            .text()
            .then(parseBody)
            .then(body => ({resp, body})),
        (e: Error) => {
          throw new NetworkError(e.message, uri);
        }
      )
      .then(({resp, body}) => {
        const aresp = {
          headers: toHeadersMap(resp.headers),
          status: resp.status,
          statusText: resp.statusText,
          url: resp.url,
          body
        };

        if (resp.ok) {
          return right<AppyError, AppyResponse<mixed>>(aresp);
        }

        if (resp.status === 404) {
          throw new BadUrl(uri, aresp);
        } else {
          throw new BadResponse(aresp);
        }
      })
      .catch((e: AppyError) => left<AppyError, AppyResponse<mixed>>(e))
  );

export const get: AppyRequestNoMethod = (uri, options) =>
  request('GET', uri, options);

export const post: AppyRequestNoMethod = (uri, options) =>
  request('POST', uri, options);

export const put: AppyRequestNoMethod = (uri, options) =>
  request('PUT', uri, options);

export const patch: AppyRequestNoMethod = (uri, options) =>
  request('PATCH', uri, options);

export const del: AppyRequestNoMethod = (uri, options) =>
  request('DELETE', uri, options);

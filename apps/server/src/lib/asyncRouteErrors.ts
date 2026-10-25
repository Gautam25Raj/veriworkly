import { createRequire } from "node:module";

import type { NextFunction, Request, Response } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import type { ParsedQs } from "qs";

/**
 * Express 4 calls a handler and ignores what it returns, so an `async` handler that rejects (a
 * throw outside its own try/catch) never reaches the error handler: it becomes an
 * `unhandledRejection`, which `index.ts` answers by shutting the worker down. Express 5 forwards
 * a returned promise's rejection to `next`; this does the same for Express 4, once, for every
 * route and middleware layer (application, routers and routes all dispatch through `Layer`).
 *
 * The type augmentation below says the same thing to the compiler: a handler may return a
 * promise. That is what lets `@typescript-eslint/no-misused-promises` accept async handlers
 * while still catching promises passed where nothing handles them. The two belong together;
 * importing this module (app.ts does, first) is what makes the type true.
 */
type Layer = {
  handle: (req: Request, res: Response, next: NextFunction) => unknown;
  handle_request: (req: Request, res: Response, next: NextFunction) => void;
};

const requireCjs = createRequire(import.meta.url);
const LayerClass = requireCjs("express/lib/router/layer.js") as { prototype: Layer };

const PATCHED = Symbol.for("veriworkly.asyncRouteErrors");

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

function installAsyncRouteErrors() {
  const proto = LayerClass.prototype as Layer & { [PATCHED]?: true };
  if (proto[PATCHED]) return;
  proto[PATCHED] = true;

  // Mirrors express/lib/router/layer.js `handle_request`, plus the returned promise.
  proto.handle_request = function handle(this: Layer, req, res, next) {
    const fn = this.handle;

    // Four parameters is an error handler; Express skips it on the request path.
    if (fn.length > 3) return next();

    try {
      const result = fn(req, res, next);
      if (isThenable(result)) {
        result.then(undefined, (error: unknown) =>
          next(error ?? new Error("Route handler rejected without a reason")),
        );
      }
    } catch (error) {
      next(error);
    }
  };
}

installAsyncRouteErrors();

declare module "express-serve-static-core" {
  // Merged with Express's own call signature: a handler may also return a promise, which the
  // patch above routes to `next` on rejection.
  interface RequestHandler<
    P = ParamsDictionary,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ResBody = any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ReqBody = any,
    ReqQuery = ParsedQs,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    LocalsObj extends Record<string, any> = Record<string, any>,
  > {
    (
      req: Request<P, ResBody, ReqBody, ReqQuery, LocalsObj>,
      res: Response<ResBody, LocalsObj>,
      next: NextFunction,
    ): void | Promise<unknown> | NonNullable<unknown> | null;
  }
}

// Issue #100 spike: the tRPC transport in front of the prototype router.
//
// The route is deliberately not under `app/`: this handler is reachable only
// from the spike's own harness, never from the deployed Customer Web.

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { spikeRouter, type SpikeContext } from "./router";

export const spikeHandler = (request: Request) =>
  fetchRequestHandler({
    endpoint: "/trpc",
    req: request,
    router: spikeRouter,
    createContext: ({ req, resHeaders }) =>
      ({ req, resHeaders }) satisfies SpikeContext,
    responseMeta: ({ errors, paths }) => ({
      // tRPC answers 200 for a successful call. The status lives on the
      // handler, not on the procedure, so one router can only pick a status
      // per procedure path.
      status: errors.length
        ? undefined
        : paths?.includes("organizations.create")
          ? 201
          : 200,
      headers: { "Cache-Control": "no-store" },
    }),
  });

import { createServer } from "node:http";

const host = "127.0.0.1";
const port = 3101;
const requests = [];

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url ?? "/", `http://${host}:${port}`)
    .pathname;

  if (request.method === "GET" && pathname === "/health") {
    response.writeHead(204).end();
    return;
  }

  if (request.method === "GET" && pathname === "/__test__/requests") {
    sendJson(response, 200, { requests });
    return;
  }

  if (
    request.method === "POST" &&
    pathname === "/external/micro-exercise/sample-references"
  ) {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);

    try {
      requests.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    } catch {
      sendJson(response, 400, { error: "Invalid JSON" });
      return;
    }

    sendJson(response, 200, {
      data: [
        {
          prompt: "E2E_ONLY_REFERENCE_PROMPT",
          questionType: "agree_disagree",
          quote: "E2E_ONLY_REFERENCE_QUOTE",
          explanation: "E2E_ONLY_REFERENCE_EXPLANATION",
        },
      ],
    });
    return;
  }

  sendJson(response, 404, { error: "Not found" });
});

server.listen(port, host);

import Ajv from "ajv";

const CONTRACT_ID = "https://aihub.example/openapi.json";

function escapePointer(value) {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function pathMatcher(template) {
  const pattern = template
    .split("/")
    .map((segment) =>
      /^\{[^/]+\}$/.test(segment)
        ? "[^/]+"
        : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    )
    .join("/");
  return new RegExp(`^${pattern}/?$`);
}

function matchesPath(template, pathname) {
  return pathMatcher(template).test(pathname);
}

function responseSchemaRef(document, method, pathname, status) {
  const entry = Object.entries(document.paths).find(([template]) =>
    matchesPath(template, pathname)
  );
  if (!entry)
    return { error: `no OpenAPI operation for ${method} ${pathname}` };

  const [template, pathItem] = entry;
  const operation = pathItem[method.toLowerCase()];
  if (!operation)
    return { error: `no OpenAPI operation for ${method} ${pathname}` };

  let response = operation.responses?.[String(status)];
  let pointer = `#/paths/${escapePointer(template)}/${method.toLowerCase()}/responses/${status}`;
  if (!response) {
    response = operation.responses?.default;
    pointer = `#/paths/${escapePointer(template)}/${method.toLowerCase()}/responses/default`;
  }
  if (!response)
    return {
      error: `status ${status} is undocumented for ${method} ${pathname}`,
    };

  while (response.$ref) {
    if (!response.$ref.startsWith("#/"))
      return { error: `unsupported OpenAPI response ref ${response.$ref}` };
    pointer = response.$ref;
    response = pointer
      .slice(2)
      .split("/")
      .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
      .reduce((value, part) => value?.[part], document);
    if (!response)
      return { error: `unresolved OpenAPI response ref ${pointer}` };
  }

  const content = response.content ?? {};
  const mediaType = Object.keys(content).find(
    (type) => type === "application/json" || type.endsWith("+json")
  );
  if (!mediaType) {
    return {
      response,
      schemaRef: null,
      hasContent: Object.keys(content).length > 0,
    };
  }

  return {
    response,
    schemaRef: `${CONTRACT_ID}${pointer}/content/${escapePointer(mediaType)}/schema`,
    hasContent: true,
  };
}

export function createContractValidator(document) {
  const ajv = new Ajv({
    allErrors: true,
    strict: false,
    validateFormats: false,
  });
  ajv.addSchema(document, CONTRACT_ID);
  const compiled = new Map();

  return ({ method, pathname, status, body, contentType = "" }) => {
    if (pathname === "/health" || pathname.startsWith("/__test__/")) return [];
    if (!pathname.startsWith("/v1/")) return [];

    const bytes =
      body == null
        ? Buffer.alloc(0)
        : Buffer.isBuffer(body)
          ? body
          : Buffer.from(body);
    let value;
    if (bytes.length > 0 && contentType.toLowerCase().includes("json")) {
      try {
        value = JSON.parse(bytes.toString("utf8"));
      } catch {
        return ["response body is not valid JSON"];
      }
    }
    if (status === 503 && value?.error?.code === "LOCAL_MOCK_OUTAGE") return [];

    const result = responseSchemaRef(document, method, pathname, status);
    if (result.error) return [result.error];
    if (!result.hasContent) {
      return bytes.length === 0 ? [] : ["unexpected response body"];
    }
    if (result.schemaRef === null)
      return ["response uses a non-JSON body that the mock does not support"];
    if (bytes.length === 0) return ["response body is missing"];
    if (!contentType.toLowerCase().includes("json"))
      return [`unexpected response content-type ${contentType || "(missing)"}`];

    let validate = compiled.get(result.schemaRef);
    if (!validate) {
      validate = ajv.getSchema(result.schemaRef);
      if (!validate)
        return [`OpenAPI schema was not compiled: ${result.schemaRef}`];
      compiled.set(result.schemaRef, validate);
    }
    return validate(value)
      ? []
      : (validate.errors ?? []).map(
          (error) =>
            `${error.instancePath || error.dataPath || "/"} ${error.message}`
        );
  };
}

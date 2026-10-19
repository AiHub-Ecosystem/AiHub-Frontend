export default async function contractTeardown() {
  const response = await fetch(
    "http://127.0.0.1:3101/__test__/contract-errors"
  );
  if (!response.ok)
    throw new Error(
      `AIHUB mock contract check failed to report: ${response.status}`
    );
  const body = (await response.json()) as {
    errors?: Array<{
      method?: string;
      pathname?: string;
      status?: number;
      errors?: string[];
    }>;
  };
  if (body.errors?.length)
    throw new Error(
      `AIHUB mock responses violate the pinned contract:\n${body.errors
        .map(
          (error) =>
            `${error.method} ${error.pathname} ${error.status}: ${error.errors?.join("; ")}`
        )
        .join("\n")}`
    );
}

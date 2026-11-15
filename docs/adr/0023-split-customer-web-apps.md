# Split Customer Web into independently deployed applications

Customer Web will remain in one Turborepo repository but build as two Next.js applications: the public Landing site at `/` and the AIHUB application under `/app`. A reverse proxy routes requests to separate deployments; the AIHUB app uses Next.js `basePath: "/app"`. Existing page URLs redirect to their `/app` equivalents, email verification and password reset paths remain compatible, and BFF endpoints move to `/app/api`.

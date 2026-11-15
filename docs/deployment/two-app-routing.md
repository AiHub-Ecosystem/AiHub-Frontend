# Two-app routing cutover

The monorepo builds `aihub-frontend` (the AIHUB application) and `aihub-landing` separately. The VPS Compose project must define services `frontend` and `landing`, publish them on `127.0.0.1:3000` and `127.0.0.1:3101`, and route requests without removing the `/app` prefix:

```nginx
location = /app { proxy_pass http://127.0.0.1:3000; }
location ^~ /app/ { proxy_pass http://127.0.0.1:3000; }
location / { proxy_pass http://127.0.0.1:3101; }
```

The `frontend` service serves the Next.js app configured with `basePath: "/app"`; preserve the request URI when proxying. The Landing app handles `/` and redirects former page URLs (including email verification and password reset links) to `/app/...`. Keep query strings intact. Do not route `/api/*` to the Landing app as a compatibility API; browser BFF callers now use `/app/api/*`.

The production deploy job stays disabled until the repository variable `TWO_APP_DEPLOYMENT_READY=true` is set after the VPS Compose services and proxy routes are in place. The deploy job expects the Landing container name `aihub-landing` for rollback.

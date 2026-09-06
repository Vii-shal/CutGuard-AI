/**
 * CutGuard AI - Native FastAPI-Compatible Swagger UI Configuration
 * Matches the clean, official FastAPI Swagger UI layout (BaseLayout + CDN assets).
 */

import path from 'path';
import { Express, Request, Response } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';

/**
 * Clean OpenAPI Specification
 */
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CutGuard AI - Video Transcoding Service API',
      version: '2.0.0',
      description: 'Production media transcoding worker service for cloud cinema pipelines with chaos engineering telemetry and AST patch verification.',
      contact: {
        name: 'CutGuard AI SRE Team',
        url: 'https://github.com/GoogleCloudPlatform'
      }
    },
    servers: [
      {
        url: 'http://localhost:4001',
        description: 'Local Transcoding Worker (Port 4001)'
      }
    ],
    tags: [
      {
        name: 'Core Pipeline',
        description: 'Transcode job orchestration, player visualizer, and worker health.'
      },
      {
        name: 'Observability',
        description: 'Structured logs and telemetry stream buffers for Loki scraping.'
      },
      {
        name: 'Chaos Engineering',
        description: 'Failure injection and cluster reset controls.'
      },
      {
        name: 'Enterprise SRE',
        description: 'Root Cause Analysis (RCA) reports and patch verification.'
      }
    ]
  },
  apis: [
    path.join(__dirname, 'routes', '*.ts'),
    path.join(__dirname, 'routes', '*.js'),
    path.join(__dirname, '..', 'src', 'routes', '*.ts'),
    './src/routes/*.ts',
    './dist/routes/*.js'
  ]
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);

/**
 * Exact native FastAPI Swagger UI HTML template (identical to FastAPI's get_swagger_ui_html)
 */
export function getFastApiSwaggerHtml(title: string = 'CutGuard AI - Video Transcoding Service API - Swagger UI'): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link type="text/css" rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
<link rel="shortcut icon" href="https://fastapi.tiangolo.com/img/favicon.png">
<title>${title}</title>
</head>
<body>
<div id="swagger-ui">
</div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<!-- \`SwaggerUIBundle\` is now available on the page -->
<script>
const ui = SwaggerUIBundle({
    url: '/openapi.json',
    "dom_id": "#swagger-ui",
    "layout": "BaseLayout",
    "deepLinking": true,
    "showExtensions": true,
    "showCommonExtensions": true,
    oauth2RedirectUrl: window.location.origin + '/docs/oauth2-redirect',
    presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIBundle.SwaggerUIStandalonePreset
    ],
})
</script>
</body>
</html>`;
}

/**
 * Express Integration Initializer
 * Mounts native FastAPI-styled Swagger UI at /docs and /docs/ and OpenAPI spec at /openapi.json
 */
export function setupSwagger(app: Express): void {
  // 1. Serve OpenAPI spec in standard FastAPI location /openapi.json (and /docs.json)
  app.get('/openapi.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(swaggerSpec);
  });

  app.get('/docs.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(swaggerSpec);
  });

  // 2. OAuth2 redirect support for complete FastAPI compatibility
  app.get('/docs/oauth2-redirect', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`<!doctype html>
<html lang="en-US">
<head>
    <title>Swagger UI: OAuth2 Redirect</title>
</head>
<body>
<script>
    'use strict';
    function run () {
        var oauth2 = window.opener.swaggerUIRedirectOauth2;
        var sentState = oauth2.state;
        var redirectUrl = oauth2.redirectUrl;
        var isValid, qp, arr;

        if (/code|token|error/.test(window.location.hash)) {
            qp = window.location.hash.substring(1).replace('?', '&');
        } else {
            qp = window.location.search.substring(1);
        }

        arr = qp.split("&");
        arr.forEach(function (v,i,_arr) { _arr[i] = '"' + v.replace('=', '":"') + '"';});
        qp = qp ? JSON.parse('{' + arr.join() + '}',
                function (key, value) {
                    return key === "" ? value : decodeURIComponent(value);
                }
        ) : {};

        isValid = qp.state === sentState;

        if ((
          oauth2.auth.schema.get("flow") === "accessCode" ||
          oauth2.auth.schema.get("flow") === "authorizationCode" ||
          oauth2.auth.schema.get("flow") === "authorization_code"
        ) && !oauth2.auth.code) {
            if (!isValid) {
                oauth2.errCb({
                    authId: oauth2.auth.name,
                    source: "auth",
                    level: "warning",
                    message: "Authorization may be unsafe, passed state was not returned"
                });
            }
            if (qp.code) {
                delete oauth2.state;
                oauth2.auth.code = qp.code;
                oauth2.callback({auth: oauth2.auth, redirectUrl: redirectUrl});
            } else {
                let oauthErrorMsg;
                if (qp.error) {
                    oauthErrorMsg = "[" + qp.error + "]: " +
                        (qp.error_description ? qp.error_description + ". " : "no accessCode received from the server. ") +
                        (qp.error_uri ? "More info: " + qp.error_uri : "");
                }

                oauth2.errCb({
                    authId: oauth2.auth.name,
                    source: "auth",
                    level: "error",
                    message: oauthErrorMsg || "[Authorization failed]: no accessCode received from the server"
                });
            }
        } else {
            oauth2.callback({auth: oauth2.auth, token: qp, isValid: isValid, redirectUrl: redirectUrl});
        }
        window.close();
    }
    window.addEventListener('DOMContentLoaded', function () {
        run();
    });
</script>
</body>
</html>`);
  });

  // 3. Serve native FastAPI Swagger UI HTML at GET /docs and GET /docs/
  const swaggerHtml = getFastApiSwaggerHtml();
  app.get('/docs', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(swaggerHtml);
  });
  app.get('/docs/', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(swaggerHtml);
  });
}

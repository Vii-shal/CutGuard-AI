/**
 * CutGuard AI - Simple, Professional OpenAPI & Swagger UI Configuration
 * Clean, readable dark theme with all schemas completely removed.
 */

import path from 'path';
import { Express, Request, Response } from 'express';
import swaggerUi, { SwaggerUiOptions } from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

/**
 * Clean & Simple Professional Dark CSS
 * High-contrast, minimal distraction, readable text, and schemas hidden.
 */
export const simpleProfessionalDarkCss = `
  /* Global Canvas & Base Styling */
  body, html {
    background-color: #0f172a !important;
    color: #f8fafc !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  .swagger-ui {
    background-color: #0f172a !important;
    color: #f8fafc !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
  }
  .swagger-ui .wrapper {
    max-width: 1200px !important;
    padding: 0 24px !important;
  }

  /* Hide Default Topbar */
  .swagger-ui .topbar {
    display: none !important;
  }

  /* REMOVE SCHEMAS COMPLETELY FROM SWAGGER */
  .swagger-ui section.models,
  .swagger-ui .models,
  section.models {
    display: none !important;
    visibility: hidden !important;
    height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  /* Info / Header Section */
  .swagger-ui .info {
    margin: 28px 0 20px 0 !important;
    padding: 24px 28px !important;
    background: #1e293b !important;
    border: 1px solid #334155 !important;
    border-radius: 8px !important;
  }
  .swagger-ui .info .title {
    color: #f8fafc !important;
    font-size: 22px !important;
    font-weight: 700 !important;
    letter-spacing: -0.02em !important;
    margin-bottom: 8px !important;
  }
  .swagger-ui .info .title small {
    background: #334155 !important;
    color: #94a3b8 !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    padding: 3px 8px !important;
    border-radius: 4px !important;
    vertical-align: middle !important;
    margin-left: 10px !important;
  }
  .swagger-ui .info p, .swagger-ui .info li {
    color: #cbd5e1 !important;
    font-size: 13px !important;
    line-height: 1.6 !important;
  }
  .swagger-ui .info a {
    color: #38bdf8 !important;
    text-decoration: none !important;
  }
  .swagger-ui .info a:hover {
    text-decoration: underline !important;
  }
  .swagger-ui .info code {
    background: #0f172a !important;
    color: #f1f5f9 !important;
    border: 1px solid #334155 !important;
    border-radius: 4px !important;
    padding: 2px 6px !important;
    font-size: 12px !important;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
  }

  /* Servers / Scheme Selector */
  .swagger-ui .scheme-container {
    background: #1e293b !important;
    border: 1px solid #334155 !important;
    border-radius: 8px !important;
    box-shadow: none !important;
    padding: 14px 20px !important;
    margin: 0 0 24px 0 !important;
  }
  .swagger-ui .schemes > label {
    color: #94a3b8 !important;
    font-size: 13px !important;
    font-weight: 600 !important;
  }
  .swagger-ui .servers > label select {
    background: #0f172a !important;
    color: #f8fafc !important;
    border: 1px solid #334155 !important;
    border-radius: 6px !important;
    padding: 6px 12px !important;
    font-size: 13px !important;
  }

  /* Tag Section Headers */
  .swagger-ui .opblock-tag {
    color: #f8fafc !important;
    font-size: 16px !important;
    font-weight: 700 !important;
    border-bottom: 1px solid #334155 !important;
    padding-bottom: 8px !important;
    margin: 28px 0 14px 0 !important;
  }
  .swagger-ui .opblock-tag small {
    color: #94a3b8 !important;
    font-size: 13px !important;
    font-weight: 400 !important;
    margin-left: 10px !important;
  }

  /* Operation Cards */
  .swagger-ui .opblock {
    background: #1e293b !important;
    border: 1px solid #334155 !important;
    border-radius: 8px !important;
    box-shadow: none !important;
    margin: 0 0 12px 0 !important;
  }
  .swagger-ui .opblock .opblock-summary {
    border-bottom: 1px solid transparent !important;
    padding: 10px 16px !important;
  }
  .swagger-ui .opblock.is-open .opblock-summary {
    border-bottom: 1px solid #334155 !important;
  }
  .swagger-ui .opblock .opblock-summary-method {
    border-radius: 4px !important;
    font-weight: 700 !important;
    font-size: 12px !important;
    padding: 5px 12px !important;
    min-width: 60px !important;
    text-align: center !important;
    text-shadow: none !important;
  }

  /* Simple, Solid Method Badges */
  .swagger-ui .opblock.opblock-post .opblock-summary-method {
    background: #059669 !important;
    color: #ffffff !important;
  }
  .swagger-ui .opblock.opblock-post {
    border-color: #334155 !important;
    background: #1e293b !important;
  }
  .swagger-ui .opblock.opblock-get .opblock-summary-method {
    background: #0284c7 !important;
    color: #ffffff !important;
  }
  .swagger-ui .opblock.opblock-get {
    border-color: #334155 !important;
    background: #1e293b !important;
  }

  .swagger-ui .opblock .opblock-summary-path {
    color: #f8fafc !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
  }
  .swagger-ui .opblock .opblock-summary-description {
    color: #94a3b8 !important;
    font-size: 13px !important;
  }

  /* Operation Details Panel */
  .swagger-ui .opblock-body {
    background: #0f172a !important;
    padding: 16px 20px !important;
    border-bottom-left-radius: 8px !important;
    border-bottom-right-radius: 8px !important;
  }
  .swagger-ui .opblock-section-header {
    background: #1e293b !important;
    border-bottom: 1px solid #334155 !important;
    border-radius: 6px 6px 0 0 !important;
    padding: 8px 14px !important;
    box-shadow: none !important;
  }
  .swagger-ui .opblock-section-header h4 {
    color: #cbd5e1 !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    letter-spacing: 0.05em !important;
    text-transform: uppercase !important;
  }
  .swagger-ui .opblock-description-wrapper p {
    color: #cbd5e1 !important;
    font-size: 13px !important;
  }

  /* Tables: Parameters and Responses */
  .swagger-ui table.parameters,
  .swagger-ui table.responses-table {
    width: 100% !important;
    border-collapse: collapse !important;
    background: transparent !important;
  }
  .swagger-ui table.parameters thead th,
  .swagger-ui table.responses-table thead th {
    color: #94a3b8 !important;
    border-bottom: 1px solid #334155 !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    text-transform: uppercase !important;
    padding: 10px 12px !important;
    background: transparent !important;
  }
  .swagger-ui table.parameters tr td,
  .swagger-ui table.responses-table tr td {
    border-bottom: 1px solid #1e293b !important;
    padding: 10px 12px !important;
    background: transparent !important;
  }
  .swagger-ui .parameter__name {
    color: #38bdf8 !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    font-family: ui-monospace, SFMono-Regular, monospace !important;
  }
  .swagger-ui .parameter__name.required:after {
    color: #ef4444 !important;
    font-size: 13px !important;
  }
  .swagger-ui .parameter__type {
    color: #94a3b8 !important;
    font-size: 12px !important;
    font-family: ui-monospace, monospace !important;
  }
  .swagger-ui .parameter__in {
    color: #64748b !important;
    font-size: 11px !important;
  }
  .swagger-ui .parameter__extension, .swagger-ui .parameter__sub_type {
    color: #94a3b8 !important;
    font-size: 11px !important;
  }
  .swagger-ui .response-col_status {
    color: #10b981 !important;
    font-size: 13px !important;
    font-weight: 700 !important;
    font-family: ui-monospace, monospace !important;
  }
  .swagger-ui .response-col_description__inner div.markdown p {
    color: #cbd5e1 !important;
    font-size: 13px !important;
    margin: 0 !important;
  }

  /* Form Inputs */
  .swagger-ui input[type=text],
  .swagger-ui textarea,
  .swagger-ui select {
    background: #1e293b !important;
    color: #f8fafc !important;
    border: 1px solid #334155 !important;
    border-radius: 6px !important;
    padding: 7px 10px !important;
    font-size: 12px !important;
    outline: none !important;
  }
  .swagger-ui input[type=text]:focus,
  .swagger-ui textarea:focus,
  .swagger-ui select:focus {
    border-color: #38bdf8 !important;
  }
  .swagger-ui select option {
    background: #1e293b !important;
    color: #f8fafc !important;
  }
  .swagger-ui .body-param__text {
    background: #0f172a !important;
    color: #f8fafc !important;
    border: 1px solid #334155 !important;
    border-radius: 6px !important;
    font-family: ui-monospace, monospace !important;
    font-size: 12px !important;
    line-height: 1.5 !important;
  }

  /* Action Buttons */
  .swagger-ui .btn {
    border-radius: 6px !important;
    border: 1px solid #334155 !important;
    color: #cbd5e1 !important;
    background: #1e293b !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    padding: 6px 14px !important;
    box-shadow: none !important;
  }
  .swagger-ui .btn:hover {
    background: #334155 !important;
    color: #ffffff !important;
  }
  .swagger-ui .btn.try-out__btn {
    color: #38bdf8 !important;
    border-color: #334155 !important;
    background: transparent !important;
  }
  .swagger-ui .btn.try-out__btn:hover {
    background: #1e293b !important;
    border-color: #38bdf8 !important;
  }
  .swagger-ui .btn.execute {
    background: #2563eb !important;
    color: #ffffff !important;
    border-color: #2563eb !important;
    font-weight: 700 !important;
  }
  .swagger-ui .btn.execute:hover {
    background: #1d4ed8 !important;
  }
  .swagger-ui .btn.cancel {
    border-color: #ef4444 !important;
    background: transparent !important;
    color: #ef4444 !important;
  }

  /* Code Blocks */
  .swagger-ui .highlight-code pre,
  .swagger-ui pre.microlight {
    background: #0f172a !important;
    border: 1px solid #334155 !important;
    border-radius: 6px !important;
    color: #f8fafc !important;
    font-size: 12px !important;
    padding: 12px 14px !important;
    line-height: 1.5 !important;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
  }
  .swagger-ui pre.microlight code {
    color: #f8fafc !important;
  }

  /* Filter Input */
  .swagger-ui .filter .operation-filter-input {
    background: #1e293b !important;
    color: #f8fafc !important;
    border: 1px solid #334155 !important;
    border-radius: 6px !important;
    padding: 8px 12px !important;
    font-size: 13px !important;
  }
  .swagger-ui .filter .operation-filter-input:focus {
    border-color: #38bdf8 !important;
  }
  .swagger-ui .response_duration {
    color: #94a3b8 !important;
    font-size: 11px !important;
    margin-left: 10px !important;
  }
`;

/**
 * Clean, Standard OpenAPI 3.0.0 Specification
 */
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CutGuard AI — Transcoding & Telemetry API',
      version: '2.4.0',
      description: `
REST API for the CutGuard AI video transcoding cluster and autonomous SRE agent.

* **Worker Service**: Port 4001
* **SRE Agent Controller**: Port 8000
* **Observability**: Grafana Cloud Loki (\`micronacho2718.grafana.net\`)
      `,
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
        name: 'Chaos Engineering',
        description: 'Failure injection and cluster reset controls.'
      },
      {
        name: 'Core Pipeline',
        description: 'Transcode job orchestration and worker health.'
      },
      {
        name: 'Enterprise SRE',
        description: 'Root Cause Analysis (RCA) reports and patch verification.'
      },
      {
        name: 'Observability',
        description: 'Structured logs and telemetry stream buffers.'
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
 * Clean Swagger UI Options
 * defaultModelsExpandDepth: -1 completely removes the Schemas / Models section
 */
export const swaggerUiOptions: SwaggerUiOptions = {
  customSiteTitle: 'CutGuard AI — API Documentation',
  customCss: simpleProfessionalDarkCss,
  swaggerOptions: {
    docExpansion: 'list',
    filter: true,
    displayRequestDuration: true,
    defaultModelsExpandDepth: -1, // HIDES SCHEMAS ACCORDION COMPLETELY
    defaultModelExpandDepth: -1   // HIDES EMBEDDED MODEL EXPANDERS
  }
};

/**
 * Express Integration Initializer
 *
 * @param app Express application instance
 */
export function setupSwagger(app: Express): void {
  app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, swaggerUiOptions)
  );

  app.get('/docs.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(swaggerSpec);
  });
}

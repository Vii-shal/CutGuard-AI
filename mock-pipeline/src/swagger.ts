/**
 * CutGuard AI - Enterprise OpenAPI / Swagger Configuration
 * Provides dark theme styling, rich schemas, and interactive test bodies for video transcoding SRE operations.
 */

import path from 'path';
import swaggerJsdoc from 'swagger-jsdoc';
import { SwaggerUiOptions } from 'swagger-ui-express';

/**
 * Polished Dark Developer Theme CSS
 * Injected into Swagger UI for high contrast deep-slate / navy aesthetic.
 */
export const darkThemeCss = `
  /* Global Page & Container Resets */
  body {
    background-color: #030712 !important;
    color: #e2e8f0 !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
    margin: 0 !important;
  }
  .swagger-ui {
    color: #e2e8f0 !important;
  }
  .swagger-ui .wrapper {
    max-width: 1380px !important;
    padding: 0 24px !important;
  }

  /* Topbar Customization */
  .swagger-ui .topbar {
    background-color: #0b0f19 !important;
    border-bottom: 1px solid #1e293b !important;
    padding: 14px 0 !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5) !important;
  }
  .swagger-ui .topbar .topbar-wrapper {
    max-width: 1380px !important;
    padding: 0 24px !important;
  }
  .swagger-ui .topbar a {
    color: #38bdf8 !important;
    font-weight: 700 !important;
    font-size: 16px !important;
    letter-spacing: -0.025em !important;
  }
  .swagger-ui .topbar img {
    filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.4)) !important;
  }

  /* Info Section & Markdown Header */
  .swagger-ui .info {
    margin: 32px 0 !important;
    background: #0b0f19 !important;
    border: 1px solid #1e293b !important;
    border-radius: 12px !important;
    padding: 28px !important;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4) !important;
  }
  .swagger-ui .info .title {
    color: #f8fafc !important;
    font-size: 28px !important;
    font-weight: 800 !important;
    letter-spacing: -0.03em !important;
    margin-bottom: 12px !important;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
  }
  .swagger-ui .info .title small {
    background: #0284c7 !important;
    color: #ffffff !important;
    border-radius: 6px !important;
    padding: 4px 8px !important;
    font-size: 12px !important;
    font-weight: 700 !important;
    margin-left: 12px !important;
    vertical-align: middle !important;
  }
  .swagger-ui .info p, .swagger-ui .info li {
    color: #94a3b8 !important;
    font-size: 14px !important;
    line-height: 1.6 !important;
  }
  .swagger-ui .info h1, .swagger-ui .info h2, .swagger-ui .info h3, .swagger-ui .info h4 {
    color: #f1f5f9 !important;
    border-color: #334155 !important;
  }
  .swagger-ui .info hr {
    border-color: #1e293b !important;
    margin: 20px 0 !important;
  }
  .swagger-ui .info a {
    color: #38bdf8 !important;
    text-decoration: none !important;
  }
  .swagger-ui .info a:hover {
    text-decoration: underline !important;
  }
  .swagger-ui .info code {
    background: #020617 !important;
    color: #38bdf8 !important;
    border: 1px solid #1e293b !important;
    border-radius: 4px !important;
    padding: 2px 6px !important;
    font-family: ui-monospace, monospace !important;
    font-size: 12px !important;
  }

  /* Server Selector & Scheme Container */
  .swagger-ui .scheme-container {
    background-color: #0b0f19 !important;
    border: 1px solid #1e293b !important;
    border-radius: 10px !important;
    box-shadow: none !important;
    padding: 16px 24px !important;
    margin: 24px 0 !important;
  }
  .swagger-ui .schemes > label {
    color: #94a3b8 !important;
    font-size: 13px !important;
    font-weight: 600 !important;
  }
  .swagger-ui .servers > label select {
    background-color: #020617 !important;
    color: #f8fafc !important;
    border: 1px solid #334155 !important;
    border-radius: 6px !important;
    padding: 6px 12px !important;
    font-family: ui-monospace, monospace !important;
  }

  /* Tags / Category Accordion Headers */
  .swagger-ui .opblock-tag {
    color: #f8fafc !important;
    font-size: 18px !important;
    font-weight: 700 !important;
    font-family: ui-monospace, SFMono-Regular, monospace !important;
    border-bottom: 1px solid #1e293b !important;
    margin: 28px 0 12px 0 !important;
    padding-bottom: 8px !important;
  }
  .swagger-ui .opblock-tag small {
    color: #64748b !important;
    font-weight: 400 !important;
    margin-left: 12px !important;
  }

  /* Operation Block Containers */
  .swagger-ui .opblock {
    background: #0b0f19 !important;
    border: 1px solid #1e293b !important;
    border-radius: 10px !important;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25) !important;
    margin: 0 0 16px !important;
    transition: all 0.2s ease !important;
  }
  .swagger-ui .opblock:hover {
    border-color: #334155 !important;
  }
  .swagger-ui .opblock .opblock-summary {
    border-bottom: 1px solid transparent !important;
    padding: 10px 16px !important;
  }
  .swagger-ui .opblock.is-open .opblock-summary {
    border-bottom: 1px solid #1e293b !important;
  }
  .swagger-ui .opblock .opblock-summary-method {
    border-radius: 6px !important;
    font-family: ui-monospace, monospace !important;
    font-weight: 800 !important;
    font-size: 12px !important;
    letter-spacing: 0.05em !important;
    padding: 6px 12px !important;
    text-shadow: none !important;
  }
  .swagger-ui .opblock.opblock-post .opblock-summary-method {
    background-color: #059669 !important;
    color: #ffffff !important;
  }
  .swagger-ui .opblock.opblock-get .opblock-summary-method {
    background-color: #0284c7 !important;
    color: #ffffff !important;
  }
  .swagger-ui .opblock.opblock-delete .opblock-summary-method {
    background-color: #e11d48 !important;
    color: #ffffff !important;
  }
  .swagger-ui .opblock.opblock-put .opblock-summary-method {
    background-color: #d97706 !important;
    color: #ffffff !important;
  }

  .swagger-ui .opblock .opblock-summary-path {
    color: #f1f5f9 !important;
    font-family: ui-monospace, monospace !important;
    font-size: 14px !important;
    font-weight: 600 !important;
  }
  .swagger-ui .opblock .opblock-summary-description {
    color: #94a3b8 !important;
    font-size: 13px !important;
  }

  /* Expanded Opblock Body */
  .swagger-ui .opblock-body {
    background: #080c14 !important;
    padding: 16px 20px !important;
    border-bottom-left-radius: 10px !important;
    border-bottom-right-radius: 10px !important;
  }
  .swagger-ui .opblock-section-header {
    background: #0f172a !important;
    border-bottom: 1px solid #334155 !important;
    border-radius: 6px 6px 0 0 !important;
    padding: 8px 16px !important;
    box-shadow: none !important;
  }
  .swagger-ui .opblock-section-header h4 {
    color: #e2e8f0 !important;
    font-size: 13px !important;
    font-weight: 700 !important;
    letter-spacing: 0.05em !important;
    text-transform: uppercase !important;
  }
  .swagger-ui .opblock-description-wrapper p,
  .swagger-ui .opblock-external-docs-wrapper p,
  .swagger-ui .opblock-title_normal p {
    color: #cbd5e1 !important;
    font-size: 13px !important;
  }

  /* Parameters Table */
  .swagger-ui table.parameters {
    border-collapse: collapse !important;
    width: 100% !important;
  }
  .swagger-ui table.parameters thead th {
    color: #94a3b8 !important;
    border-bottom: 1px solid #334155 !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    letter-spacing: 0.05em !important;
    text-transform: uppercase !important;
    padding: 10px 14px !important;
  }
  .swagger-ui table.parameters tr td {
    border-bottom: 1px solid #1e293b !important;
    padding: 12px 14px !important;
    vertical-align: top !important;
  }
  .swagger-ui .parameter__name {
    color: #38bdf8 !important;
    font-family: ui-monospace, monospace !important;
    font-size: 13px !important;
    font-weight: 700 !important;
  }
  .swagger-ui .parameter__name.required:after {
    color: #f43f5e !important;
    font-size: 14px !important;
  }
  .swagger-ui .parameter__type {
    color: #c084fc !important;
    font-family: ui-monospace, monospace !important;
    font-size: 12px !important;
  }
  .swagger-ui .parameter__in {
    color: #64748b !important;
    font-family: ui-monospace, monospace !important;
    font-size: 11px !important;
    font-style: italic !important;
  }
  .swagger-ui .parameter__extension, .swagger-ui .parameter__sub_type {
    color: #94a3b8 !important;
    font-size: 11px !important;
  }

  /* Responses Table */
  .swagger-ui table.responses-table {
    width: 100% !important;
    border-collapse: collapse !important;
  }
  .swagger-ui table.responses-table thead th {
    color: #94a3b8 !important;
    border-bottom: 1px solid #334155 !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    letter-spacing: 0.05em !important;
    text-transform: uppercase !important;
    padding: 10px 14px !important;
  }
  .swagger-ui table.responses-table tr td {
    border-bottom: 1px solid #1e293b !important;
    padding: 12px 14px !important;
  }
  .swagger-ui .response-col_status {
    color: #34d399 !important;
    font-family: ui-monospace, monospace !important;
    font-size: 14px !important;
    font-weight: 800 !important;
  }
  .swagger-ui .response-col_description__inner div.markdown p {
    color: #cbd5e1 !important;
    font-size: 13px !important;
    margin: 0 !important;
  }

  /* Inputs, Textareas, and Dropdown Selectors */
  .swagger-ui input[type=text],
  .swagger-ui textarea,
  .swagger-ui select {
    background-color: #020617 !important;
    color: #f8fafc !important;
    border: 1px solid #334155 !important;
    border-radius: 6px !important;
    padding: 8px 12px !important;
    font-family: ui-monospace, monospace !important;
    font-size: 12px !important;
    outline: none !important;
    transition: border-color 0.2s ease !important;
  }
  .swagger-ui input[type=text]:focus,
  .swagger-ui textarea:focus,
  .swagger-ui select:focus {
    border-color: #38bdf8 !important;
    box-shadow: 0 0 0 1px #38bdf8 !important;
  }
  .swagger-ui select option {
    background-color: #020617 !important;
    color: #f8fafc !important;
  }
  .swagger-ui .body-param__text {
    background-color: #020617 !important;
    color: #f8fafc !important;
    border: 1px solid #334155 !important;
    border-radius: 6px !important;
    font-family: ui-monospace, monospace !important;
    font-size: 12px !important;
    line-height: 1.5 !important;
  }

  /* Buttons ("Try it out", "Execute", "Cancel") */
  .swagger-ui .btn {
    border-radius: 6px !important;
    border: 1px solid #334155 !important;
    color: #cbd5e1 !important;
    background: #0f172a !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    padding: 6px 14px !important;
    box-shadow: none !important;
    transition: all 0.2s ease !important;
  }
  .swagger-ui .btn:hover {
    background: #1e293b !important;
    color: #ffffff !important;
    border-color: #475569 !important;
  }
  .swagger-ui .btn.try-out__btn {
    color: #38bdf8 !important;
    border-color: #0284c7 !important;
    background: rgba(2, 132, 199, 0.15) !important;
  }
  .swagger-ui .btn.try-out__btn:hover {
    background: rgba(2, 132, 199, 0.3) !important;
    color: #ffffff !important;
  }
  .swagger-ui .btn.execute {
    background-color: #2563eb !important;
    color: #ffffff !important;
    border-color: #3b82f6 !important;
    font-weight: 700 !important;
    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4) !important;
  }
  .swagger-ui .btn.execute:hover {
    background-color: #1d4ed8 !important;
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.6) !important;
  }
  .swagger-ui .btn.cancel {
    border-color: #e11d48 !important;
    background-color: rgba(225, 29, 72, 0.15) !important;
    color: #fb7185 !important;
  }
  .swagger-ui .btn.cancel:hover {
    background-color: rgba(225, 29, 72, 0.3) !important;
  }

  /* Code Blocks, Response Bodies & Syntax Highlighting */
  .swagger-ui .highlight-code pre,
  .swagger-ui pre.microlight {
    background: #020617 !important;
    border: 1px solid #1e293b !important;
    border-radius: 8px !important;
    color: #f1f5f9 !important;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
    font-size: 12px !important;
    padding: 14px !important;
    line-height: 1.6 !important;
  }
  .swagger-ui pre.microlight code {
    color: #f1f5f9 !important;
  }
  .swagger-ui .model-box {
    background-color: #020617 !important;
    border: 1px solid #1e293b !important;
    border-radius: 6px !important;
    padding: 10px !important;
  }
  .swagger-ui .model {
    color: #cbd5e1 !important;
    font-family: ui-monospace, monospace !important;
    font-size: 12px !important;
  }
  .swagger-ui .model-title {
    color: #f1f5f9 !important;
    font-weight: 700 !important;
  }
  .swagger-ui .prop-type {
    color: #c084fc !important;
  }
  .swagger-ui .prop-format {
    color: #64748b !important;
  }

  /* Models Section at Bottom */
  .swagger-ui section.models {
    border: 1px solid #1e293b !important;
    border-radius: 10px !important;
    background-color: #0b0f19 !important;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25) !important;
    margin: 36px 0 !important;
  }
  .swagger-ui section.models h4 {
    color: #94a3b8 !important;
    font-size: 14px !important;
    font-weight: 700 !important;
    letter-spacing: 0.05em !important;
    text-transform: uppercase !important;
    border-bottom: 1px solid #1e293b !important;
    padding: 12px 18px !important;
  }

  /* Filter / Search Bar */
  .swagger-ui .filter .operation-filter-input {
    background-color: #020617 !important;
    color: #f8fafc !important;
    border: 1px solid #334155 !important;
    border-radius: 8px !important;
    padding: 8px 14px !important;
    font-size: 13px !important;
  }
  .swagger-ui .filter .operation-filter-input:focus {
    border-color: #38bdf8 !important;
  }

  /* Live Duration & Status Tag Badges */
  .swagger-ui .response_duration {
    color: #38bdf8 !important;
    font-family: ui-monospace, monospace !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    margin-left: 10px !important;
  }
`;

/**
 * Enterprise OpenAPI 3.0.0 Specification
 */
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CutGuard AI - Transcoding Cluster & SRE Telemetry API',
      version: '2.4.0',
      description: `
# CutGuard AI — Autonomous Video Transcoding Incident SRE Engine

High-throughput distributed media rendering and FFmpeg transcoding edge service for the **Agentic Cinema Hackathon** (Google Cloud + Devpost) supporting the **Grafana Labs Track**.

---

### 🏛️ Architectural Topology
* **Service Role**: Video Transcoding Edge Worker (\`Port 4001\`)
* **Autonomous Controller**: CutGuard SRE Agent (\`Port 8000\`)
* **Metrics Target**: Grafana Cloud Loki & Prometheus (\`micronacho2718.grafana.net\`)
* **Cluster Infrastructure**: GKE Cinema Render Pool (\`us-central1\`)

---

### ⚡ Key Capabilities
1. **Automated Incident Triage**: Captures unhandled \`SIGABRT\` / \`SIGSEGV\` exit signals and memory exhaustion events.
2. **Loki Telemetry Emitting**: Pushes ISO structured log events directly to Grafana Cloud Loki ring buffers.
3. **Chaos Injection**: Simulates real-world video pipeline failures (bitrate profile omissions, pixel format mismatches, DTS non-monotonic timestamps).
4. **Enterprise RCA & Hot-Patching**: Exposes full root-cause post-mortems and live zero-downtime patch application.
      `,
      contact: {
        name: 'CutGuard AI Systems & SRE Team',
        url: 'https://github.com/GoogleCloudPlatform'
      }
    },
    servers: [
      {
        url: 'http://localhost:4001',
        description: 'Local Edge Transcoding Worker (Primary :4001)'
      },
      {
        url: 'http://localhost:8000',
        description: 'CutGuard Autonomous SRE Agent Controller (:8000)'
      }
    ],
    tags: [
      {
        name: 'Chaos Engineering',
        description: 'Failure injection, SIGABRT / SIGSEGV simulation, and cluster reset controls.'
      },
      {
        name: 'Core Pipeline',
        description: 'Transcode orchestration, job tracking, and worker health telemetry.'
      },
      {
        name: 'Enterprise SRE',
        description: 'Root Cause Analysis (RCA), AST Blast Radius, and autonomous patch verification.'
      },
      {
        name: 'Observability',
        description: 'Structured JSON telemetry and ring buffer logs for Grafana Loki scraping.'
      }
    ],
    components: {
      schemas: {
        ChaosInjectRequest: {
          type: 'object',
          required: ['scenario'],
          properties: {
            scenario: {
              type: 'string',
              enum: ['UNSUPPORTED_PIXEL_FORMAT', 'FFMPEG_OOM', 'SEGMENT_CORRUPTION'],
              example: 'UNSUPPORTED_PIXEL_FORMAT',
              description: 'Simulated failure scenario to trigger in the video worker'
            },
            targetWorker: {
              type: 'string',
              example: 'worker-transcode-04',
              description: 'Identifier of the target transcoder pod in the cluster'
            },
            severity: {
              type: 'string',
              enum: ['CRITICAL', 'HIGH', 'MEDIUM'],
              example: 'CRITICAL',
              description: 'Failure severity level classification'
            }
          }
        },
        ChaosResetResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'HEALTHY'
            },
            isCrashed: {
              type: 'boolean',
              example: false
            },
            activeScenario: {
              type: 'string',
              example: 'NONE'
            },
            isFailureArmed: {
              type: 'boolean',
              example: false
            },
            activeIncident: {
              type: 'object',
              nullable: true,
              example: null
            },
            message: {
              type: 'string',
              example: 'Pipeline restored to normal operating state.'
            }
          }
        },
        TranscodeRequest: {
          type: 'object',
          required: ['videoId', 'resolution', 'codec', 'sourceUrl'],
          properties: {
            videoId: {
              type: 'string',
              example: 'vid-cinema-94021',
              description: 'Unique video asset or scene chunk identifier'
            },
            resolution: {
              type: 'string',
              enum: ['1080p', '4k', '720p', '480p'],
              example: '1080p',
              description: 'Target encoding resolution preset'
            },
            codec: {
              type: 'string',
              enum: ['h264', 'hevc', 'av1'],
              example: 'h264',
              description: 'Target video codec'
            },
            sourceUrl: {
              type: 'string',
              example: 'gs://raw-cinema-assets/scene-04-take-02.mov',
              description: 'Cloud storage input master media URI'
            },
            pixelFormat: {
              type: 'string',
              enum: ['yuv420p', 'yuv422p10le', 'yuv444p'],
              example: 'yuv420p',
              description: 'Pixel format and chroma subsampling profile'
            }
          }
        },
        RCAReportResponse: {
          type: 'object',
          properties: {
            incidentId: {
              type: 'string',
              example: 'INC-AUTO-4091'
            },
            severity: {
              type: 'string',
              example: 'CRITICAL'
            },
            mttr: {
              type: 'string',
              example: '38s'
            },
            affectedPipelineStage: {
              type: 'string',
              example: 'FFMPEG_ENCODE'
            },
            rootCause: {
              type: 'string',
              example: 'Fatal pixel format incompatibility between 10-bit source ingest and H.264 baseline encoder profile.'
            },
            affectedFile: {
              type: 'string',
              example: 'src/transcoder/ffmpegArgs.ts'
            },
            gitPatch: {
              type: 'string',
              example: "--- a/src/transcoder/ffmpegArgs.ts\n+++ b/src/transcoder/ffmpegArgs.ts\n@@ -48,4 +48,6 @@\n-  if (pixelFormat === 'yuv422p10le' && profile === 'baseline') {\n+  const sanitizedPixelFormat = (pixelFormat === 'yuv422p10le' && profile === 'baseline') ? 'yuv420p' : pixelFormat;"
            },
            appliedPatch: {
              type: 'string',
              example: "--- a/src/transcoder/ffmpegArgs.ts\n+++ b/src/transcoder/ffmpegArgs.ts\n@@ -48,4 +48,6 @@\n-  if (pixelFormat === 'yuv422p10le' && profile === 'baseline') {\n+  const sanitizedPixelFormat = (pixelFormat === 'yuv422p10le' && profile === 'baseline') ? 'yuv420p' : pixelFormat;"
            },
            verificationStatus: {
              type: 'string',
              example: 'PASSED_IN_SANDBOX'
            },
            operatorSignOff: {
              type: 'boolean',
              example: true
            },
            operatorNotes: {
              type: 'string',
              example: 'Autonomous patch authorized by Lead SRE Engineer via LangGraph Human-in-the-Loop decision gate.'
            },
            timestamp: {
              type: 'string',
              example: '2026-09-06T11:20:00.000Z'
            },
            resolvedAt: {
              type: 'string',
              example: '2026-09-06T11:20:38.000Z'
            },
            rootCauseAnalysis: {
              type: 'object',
              properties: {
                summary: { type: 'string', example: 'Fatal pixel format incompatibility between 10-bit source ingest and H.264 baseline encoder profile.' },
                triggerMechanism: { type: 'string', example: 'Video chunk manifest specified pixelFormat yuv422p10le while profile defaulted to baseline. Transcoding process killed with SIGSEGV (exit code 139).' },
                failingFile: { type: 'string', example: 'src/transcoder/ffmpegArgs.ts' },
                exitSignal: { type: 'string', example: 'SIGSEGV (Exit 139)' },
                blastRadiusScore: { type: 'number', example: 80 },
                impactSummary: { type: 'string', example: 'Cascading failure threatening master HLS playlist assembly and downstream video ingestion chunk pool.' }
              }
            }
          }
        },
        LogsResponse: {
          type: 'object',
          properties: {
            total: { type: 'integer', example: 50 },
            limit: { type: 'integer', example: 50 },
            logs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  timestamp: { type: 'string', example: '2026-09-06T11:20:15.000Z' },
                  level: { type: 'string', example: 'error' },
                  stage: { type: 'string', example: '[FFMPEG_ENCODE]' },
                  jobId: { type: 'string', example: 'Job-84920' },
                  message: { type: 'string', example: 'Fatal error: Invalid pixel format yuv422p10le for codec libx264 with profile baseline.' },
                  metadata: { type: 'object' }
                }
              }
            }
          }
        }
      }
    }
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
 * Swagger UI Custom Setup Options
 */
export const swaggerUiOptions: SwaggerUiOptions = {
  customSiteTitle: 'CutGuard AI - Transcoding Cluster & SRE Telemetry API',
  customCss: darkThemeCss,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'list',
    filter: true,
    tryItOutEnabled: true,
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2
  }
};

/**
 * CutGuard AI - Enterprise OpenAPI / Swagger Configuration Module
 * High-contrast developer dark theme inspired by Vercel and Supabase.
 * Centralized design tokens, full OpenAPI 3.0.0 schemas, and clean Express integration.
 */

import path from 'path';
import { Express, Request, Response } from 'express';
import swaggerUi, { SwaggerUiOptions } from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

/**
 * Design System Tokens (Vercel & Supabase Inspired Dark Palette)
 */
export const THEME_TOKENS = {
  // Surfaces & Backgrounds
  canvas: '#090d16',
  surface: '#111827',
  surfaceSubtle: '#1f2937',
  surfaceDark: '#0b0f19',
  border: '#374151',
  borderSubtle: '#1f2937',
  borderFocus: '#0ea5e9',

  // Typography
  textPrimary: '#f9fafb',
  textSecondary: '#e5e7eb',
  textMuted: '#9ca3af',
  textDim: '#6b7280',

  // Method Accents & Status
  post: '#10b981',
  postBg: 'rgba(16, 185, 129, 0.10)',
  postBorder: 'rgba(16, 185, 129, 0.35)',
  get: '#0ea5e9',
  getBg: 'rgba(14, 165, 233, 0.10)',
  getBorder: 'rgba(14, 165, 233, 0.35)',
  put: '#f59e0b',
  putBg: 'rgba(245, 158, 11, 0.10)',
  putBorder: 'rgba(245, 158, 11, 0.35)',
  delete: '#ef4444',
  deleteBg: 'rgba(239, 68, 68, 0.10)',
  deleteBorder: 'rgba(239, 68, 68, 0.35)',
  execute: '#059669',
  executeHover: '#047857',
  danger: '#ef4444',
  dangerBg: 'rgba(239, 68, 68, 0.15)',
  accentGlow: 'rgba(14, 165, 233, 0.25)',

  // Typography Stacks & Radii
  fontSans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", Helvetica, Arial, sans-serif',
  fontMono: 'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Monaco, Consolas, monospace',
  radiusSm: '4px',
  radiusMd: '6px',
  radiusLg: '10px',
  radiusXl: '12px'
} as const;

/**
 * Polished Dark Developer Theme CSS
 * Injected dynamically using THEME_TOKENS interpolation for maximum maintainability.
 */
export const darkThemeCss = `
  /* ==========================================================================
     CutGuard AI — Enterprise Vercel/Supabase Developer Dark Theme
     ========================================================================== */

  /* Global Canvas & Typography */
  body, html {
    background-color: ${THEME_TOKENS.canvas} !important;
    color: ${THEME_TOKENS.textPrimary} !important;
    font-family: ${THEME_TOKENS.fontSans} !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  .swagger-ui {
    background-color: ${THEME_TOKENS.canvas} !important;
    color: ${THEME_TOKENS.textPrimary} !important;
    font-family: ${THEME_TOKENS.fontSans} !important;
  }
  .swagger-ui .wrapper {
    max-width: 1400px !important;
    padding: 0 32px !important;
  }

  /* Minimal Enterprise Topbar Replacement */
  .swagger-ui .topbar {
    display: none !important;
  }
  .swagger-ui::before {
    content: "CutGuard AI • Telemetry & Transcode Pipeline";
    display: flex;
    align-items: center;
    height: 52px;
    padding: 0 32px 0 44px;
    background-color: ${THEME_TOKENS.surface};
    border-bottom: 1px solid ${THEME_TOKENS.border};
    color: ${THEME_TOKENS.textPrimary};
    font-family: ${THEME_TOKENS.fontMono};
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    background-image: radial-gradient(circle at 24px 50%, ${THEME_TOKENS.post} 4px, transparent 5px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    position: sticky;
    top: 0;
    z-index: 1000;
  }

  /* Documentation Info Card */
  .swagger-ui .info {
    margin: 32px 0 !important;
    background: ${THEME_TOKENS.surface} !important;
    border: 1px solid ${THEME_TOKENS.border} !important;
    border-radius: ${THEME_TOKENS.radiusXl} !important;
    padding: 32px !important;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5) !important;
  }
  .swagger-ui .info .title {
    color: ${THEME_TOKENS.textPrimary} !important;
    font-size: 28px !important;
    font-weight: 800 !important;
    letter-spacing: -0.03em !important;
    font-family: ${THEME_TOKENS.fontMono} !important;
    margin-bottom: 12px !important;
  }
  .swagger-ui .info .title small {
    background: ${THEME_TOKENS.get} !important;
    color: #ffffff !important;
    border-radius: ${THEME_TOKENS.radiusSm} !important;
    padding: 3px 8px !important;
    font-size: 12px !important;
    font-weight: 700 !important;
    margin-left: 12px !important;
    vertical-align: middle !important;
  }
  .swagger-ui .info p, .swagger-ui .info li {
    color: ${THEME_TOKENS.textMuted} !important;
    font-size: 14px !important;
    line-height: 1.65 !important;
  }
  .swagger-ui .info h1, .swagger-ui .info h2, .swagger-ui .info h3, .swagger-ui .info h4 {
    color: ${THEME_TOKENS.textPrimary} !important;
    border-color: ${THEME_TOKENS.border} !important;
  }
  .swagger-ui .info hr {
    border-color: ${THEME_TOKENS.border} !important;
    margin: 20px 0 !important;
  }
  .swagger-ui .info a {
    color: ${THEME_TOKENS.get} !important;
    text-decoration: none !important;
  }
  .swagger-ui .info a:hover {
    text-decoration: underline !important;
  }
  .swagger-ui .info code {
    background: ${THEME_TOKENS.surfaceDark} !important;
    color: ${THEME_TOKENS.get} !important;
    border: 1px solid ${THEME_TOKENS.borderSubtle} !important;
    border-radius: ${THEME_TOKENS.radiusSm} !important;
    padding: 2px 6px !important;
    font-family: ${THEME_TOKENS.fontMono} !important;
    font-size: 12px !important;
  }

  /* Server / Scheme Controls */
  .swagger-ui .scheme-container {
    background-color: ${THEME_TOKENS.surface} !important;
    border: 1px solid ${THEME_TOKENS.border} !important;
    border-radius: ${THEME_TOKENS.radiusLg} !important;
    box-shadow: none !important;
    padding: 16px 24px !important;
    margin: 24px 0 !important;
  }
  .swagger-ui .schemes > label {
    color: ${THEME_TOKENS.textMuted} !important;
    font-size: 13px !important;
    font-weight: 600 !important;
  }
  .swagger-ui .servers > label select {
    background-color: ${THEME_TOKENS.surfaceDark} !important;
    color: ${THEME_TOKENS.textPrimary} !important;
    border: 1px solid ${THEME_TOKENS.border} !important;
    border-radius: ${THEME_TOKENS.radiusMd} !important;
    padding: 8px 12px !important;
    font-family: ${THEME_TOKENS.fontMono} !important;
  }

  /* Section Categories (Tags) */
  .swagger-ui .opblock-tag {
    color: ${THEME_TOKENS.textPrimary} !important;
    font-size: 18px !important;
    font-weight: 700 !important;
    font-family: ${THEME_TOKENS.fontMono} !important;
    border-bottom: 1px solid ${THEME_TOKENS.border} !important;
    margin: 32px 0 16px 0 !important;
    padding-bottom: 10px !important;
  }
  .swagger-ui .opblock-tag small {
    color: ${THEME_TOKENS.textDim} !important;
    font-size: 13px !important;
    font-weight: 400 !important;
    margin-left: 12px !important;
  }

  /* Operational Cards */
  .swagger-ui .opblock {
    background: ${THEME_TOKENS.surface} !important;
    border: 1px solid ${THEME_TOKENS.border} !important;
    border-radius: ${THEME_TOKENS.radiusLg} !important;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3) !important;
    margin: 0 0 16px !important;
    transition: all 0.2s ease !important;
  }
  .swagger-ui .opblock:hover {
    border-color: ${THEME_TOKENS.borderFocus} !important;
  }
  .swagger-ui .opblock.is-open {
    border-color: ${THEME_TOKENS.border} !important;
  }
  .swagger-ui .opblock .opblock-summary {
    border-bottom: 1px solid transparent !important;
    padding: 12px 18px !important;
  }
  .swagger-ui .opblock.is-open .opblock-summary {
    border-bottom: 1px solid ${THEME_TOKENS.border} !important;
  }
  .swagger-ui .opblock .opblock-summary-method {
    border-radius: ${THEME_TOKENS.radiusMd} !important;
    font-family: ${THEME_TOKENS.fontMono} !important;
    font-weight: 800 !important;
    font-size: 12px !important;
    letter-spacing: 0.05em !important;
    padding: 6px 14px !important;
    text-shadow: none !important;
  }

  /* Method Badges */
  .swagger-ui .opblock.opblock-post .opblock-summary-method {
    background-color: ${THEME_TOKENS.post} !important;
    color: #ffffff !important;
  }
  .swagger-ui .opblock.opblock-post {
    border-color: ${THEME_TOKENS.postBorder} !important;
    background: ${THEME_TOKENS.surface} !important;
  }
  .swagger-ui .opblock.opblock-get .opblock-summary-method {
    background-color: ${THEME_TOKENS.get} !important;
    color: #ffffff !important;
  }
  .swagger-ui .opblock.opblock-get {
    border-color: ${THEME_TOKENS.getBorder} !important;
    background: ${THEME_TOKENS.surface} !important;
  }
  .swagger-ui .opblock.opblock-put .opblock-summary-method {
    background-color: ${THEME_TOKENS.put} !important;
    color: #ffffff !important;
  }
  .swagger-ui .opblock.opblock-put {
    border-color: ${THEME_TOKENS.putBorder} !important;
    background: ${THEME_TOKENS.surface} !important;
  }
  .swagger-ui .opblock.opblock-delete .opblock-summary-method {
    background-color: ${THEME_TOKENS.delete} !important;
    color: #ffffff !important;
  }
  .swagger-ui .opblock.opblock-delete {
    border-color: ${THEME_TOKENS.deleteBorder} !important;
    background: ${THEME_TOKENS.surface} !important;
  }

  .swagger-ui .opblock .opblock-summary-path {
    color: ${THEME_TOKENS.textPrimary} !important;
    font-family: ${THEME_TOKENS.fontMono} !important;
    font-size: 14px !important;
    font-weight: 600 !important;
  }
  .swagger-ui .opblock .opblock-summary-description {
    color: ${THEME_TOKENS.textMuted} !important;
    font-size: 13px !important;
  }

  /* Expanded Opblock Body */
  .swagger-ui .opblock-body {
    background: ${THEME_TOKENS.canvas} !important;
    padding: 20px 24px !important;
    border-bottom-left-radius: ${THEME_TOKENS.radiusLg} !important;
    border-bottom-right-radius: ${THEME_TOKENS.radiusLg} !important;
  }
  .swagger-ui .opblock-section-header {
    background: ${THEME_TOKENS.surfaceSubtle} !important;
    border-bottom: 1px solid ${THEME_TOKENS.border} !important;
    border-radius: ${THEME_TOKENS.radiusMd} ${THEME_TOKENS.radiusMd} 0 0 !important;
    padding: 10px 18px !important;
    box-shadow: none !important;
  }
  .swagger-ui .opblock-section-header h4 {
    color: ${THEME_TOKENS.textPrimary} !important;
    font-size: 12px !important;
    font-weight: 700 !important;
    letter-spacing: 0.05em !important;
    text-transform: uppercase !important;
  }
  .swagger-ui .opblock-description-wrapper p,
  .swagger-ui .opblock-external-docs-wrapper p,
  .swagger-ui .opblock-title_normal p {
    color: ${THEME_TOKENS.textSecondary} !important;
    font-size: 13px !important;
  }

  /* Parameters Table Contrast Artifact Fixes */
  .swagger-ui table.parameters {
    border-collapse: collapse !important;
    width: 100% !important;
    background: transparent !important;
  }
  .swagger-ui table.parameters thead th {
    color: ${THEME_TOKENS.textMuted} !important;
    border-bottom: 1px solid ${THEME_TOKENS.border} !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    letter-spacing: 0.05em !important;
    text-transform: uppercase !important;
    padding: 12px 16px !important;
    background: transparent !important;
  }
  .swagger-ui table.parameters tr td {
    border-bottom: 1px solid ${THEME_TOKENS.borderSubtle} !important;
    padding: 14px 16px !important;
    vertical-align: top !important;
    background: transparent !important;
  }
  .swagger-ui .parameter__name {
    color: ${THEME_TOKENS.get} !important;
    font-family: ${THEME_TOKENS.fontMono} !important;
    font-size: 13px !important;
    font-weight: 700 !important;
  }
  .swagger-ui .parameter__name.required:after {
    color: ${THEME_TOKENS.danger} !important;
    font-size: 14px !important;
  }
  .swagger-ui .parameter__type {
    color: #c084fc !important;
    font-family: ${THEME_TOKENS.fontMono} !important;
    font-size: 12px !important;
  }
  .swagger-ui .parameter__in {
    color: ${THEME_TOKENS.textDim} !important;
    font-family: ${THEME_TOKENS.fontMono} !important;
    font-size: 11px !important;
    font-style: italic !important;
  }
  .swagger-ui .parameter__extension, .swagger-ui .parameter__sub_type {
    color: ${THEME_TOKENS.textMuted} !important;
    font-size: 11px !important;
  }

  /* Responses Table */
  .swagger-ui table.responses-table {
    width: 100% !important;
    border-collapse: collapse !important;
    background: transparent !important;
  }
  .swagger-ui table.responses-table thead th {
    color: ${THEME_TOKENS.textMuted} !important;
    border-bottom: 1px solid ${THEME_TOKENS.border} !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    letter-spacing: 0.05em !important;
    text-transform: uppercase !important;
    padding: 12px 16px !important;
    background: transparent !important;
  }
  .swagger-ui table.responses-table tr td {
    border-bottom: 1px solid ${THEME_TOKENS.borderSubtle} !important;
    padding: 14px 16px !important;
    background: transparent !important;
  }
  .swagger-ui .response-col_status {
    color: ${THEME_TOKENS.post} !important;
    font-family: ${THEME_TOKENS.fontMono} !important;
    font-size: 14px !important;
    font-weight: 800 !important;
  }
  .swagger-ui .response-col_description__inner div.markdown p {
    color: ${THEME_TOKENS.textSecondary} !important;
    font-size: 13px !important;
    margin: 0 !important;
  }

  /* Form Inputs (Vercel / Supabase Style) */
  .swagger-ui input[type=text],
  .swagger-ui textarea,
  .swagger-ui select {
    background-color: ${THEME_TOKENS.surface} !important;
    color: ${THEME_TOKENS.textPrimary} !important;
    border: 1px solid ${THEME_TOKENS.border} !important;
    border-radius: ${THEME_TOKENS.radiusMd} !important;
    padding: 8px 12px !important;
    font-family: ${THEME_TOKENS.fontMono} !important;
    font-size: 12px !important;
    outline: none !important;
    transition: all 0.2s ease !important;
  }
  .swagger-ui input[type=text]:focus,
  .swagger-ui textarea:focus,
  .swagger-ui select:focus {
    border-color: ${THEME_TOKENS.borderFocus} !important;
    box-shadow: 0 0 0 2px ${THEME_TOKENS.accentGlow} !important;
    background-color: ${THEME_TOKENS.surfaceSubtle} !important;
  }
  .swagger-ui select option {
    background-color: ${THEME_TOKENS.surface} !important;
    color: ${THEME_TOKENS.textPrimary} !important;
  }
  .swagger-ui .body-param__text {
    background-color: ${THEME_TOKENS.surfaceDark} !important;
    color: ${THEME_TOKENS.textPrimary} !important;
    border: 1px solid ${THEME_TOKENS.border} !important;
    border-radius: ${THEME_TOKENS.radiusMd} !important;
    font-family: ${THEME_TOKENS.fontMono} !important;
    font-size: 12px !important;
    line-height: 1.6 !important;
  }

  /* Action Buttons */
  .swagger-ui .btn {
    border-radius: ${THEME_TOKENS.radiusMd} !important;
    border: 1px solid ${THEME_TOKENS.border} !important;
    color: ${THEME_TOKENS.textSecondary} !important;
    background: ${THEME_TOKENS.surfaceSubtle} !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    padding: 7px 16px !important;
    box-shadow: none !important;
    transition: all 0.2s ease !important;
  }
  .swagger-ui .btn:hover {
    background: ${THEME_TOKENS.border} !important;
    color: #ffffff !important;
  }
  .swagger-ui .btn.try-out__btn {
    color: ${THEME_TOKENS.get} !important;
    border-color: ${THEME_TOKENS.getBorder} !important;
    background: ${THEME_TOKENS.getBg} !important;
  }
  .swagger-ui .btn.try-out__btn:hover {
    background: rgba(14, 165, 233, 0.25) !important;
    color: #ffffff !important;
  }
  .swagger-ui .btn.execute {
    background-color: ${THEME_TOKENS.execute} !important;
    color: #ffffff !important;
    border-color: ${THEME_TOKENS.post} !important;
    font-weight: 700 !important;
    box-shadow: 0 2px 8px rgba(5, 150, 105, 0.4) !important;
  }
  .swagger-ui .btn.execute:hover {
    background-color: ${THEME_TOKENS.executeHover} !important;
    box-shadow: 0 4px 14px rgba(5, 150, 105, 0.6) !important;
  }
  .swagger-ui .btn.cancel {
    border-color: ${THEME_TOKENS.danger} !important;
    background-color: ${THEME_TOKENS.dangerBg} !important;
    color: ${THEME_TOKENS.danger} !important;
  }
  .swagger-ui .btn.cancel:hover {
    background-color: rgba(239, 68, 68, 0.3) !important;
    color: #ffffff !important;
  }

  /* Code Blocks & Response Previews */
  .swagger-ui .highlight-code pre,
  .swagger-ui pre.microlight {
    background: ${THEME_TOKENS.surfaceDark} !important;
    border: 1px solid ${THEME_TOKENS.border} !important;
    border-radius: ${THEME_TOKENS.radiusLg} !important;
    color: ${THEME_TOKENS.textPrimary} !important;
    font-family: ${THEME_TOKENS.fontMono} !important;
    font-size: 12px !important;
    padding: 16px !important;
    line-height: 1.6 !important;
  }
  .swagger-ui pre.microlight code {
    color: ${THEME_TOKENS.textPrimary} !important;
  }
  .swagger-ui .model-box {
    background-color: ${THEME_TOKENS.surfaceDark} !important;
    border: 1px solid ${THEME_TOKENS.borderSubtle} !important;
    border-radius: ${THEME_TOKENS.radiusMd} !important;
    padding: 12px !important;
  }
  .swagger-ui .model {
    color: ${THEME_TOKENS.textSecondary} !important;
    font-family: ${THEME_TOKENS.fontMono} !important;
    font-size: 12px !important;
  }
  .swagger-ui .model-title {
    color: ${THEME_TOKENS.textPrimary} !important;
    font-weight: 700 !important;
  }
  .swagger-ui .prop-type {
    color: #c084fc !important;
  }
  .swagger-ui .prop-format {
    color: ${THEME_TOKENS.textDim} !important;
  }

  /* Models Section at Bottom */
  .swagger-ui section.models {
    border: 1px solid ${THEME_TOKENS.border} !important;
    border-radius: ${THEME_TOKENS.radiusLg} !important;
    background-color: ${THEME_TOKENS.surface} !important;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3) !important;
    margin: 40px 0 !important;
  }
  .swagger-ui section.models h4 {
    color: ${THEME_TOKENS.textMuted} !important;
    font-size: 13px !important;
    font-weight: 700 !important;
    letter-spacing: 0.05em !important;
    text-transform: uppercase !important;
    border-bottom: 1px solid ${THEME_TOKENS.border} !important;
    padding: 14px 20px !important;
  }

  /* Live Duration & Filter Search */
  .swagger-ui .filter .operation-filter-input {
    background-color: ${THEME_TOKENS.surface} !important;
    color: ${THEME_TOKENS.textPrimary} !important;
    border: 1px solid ${THEME_TOKENS.border} !important;
    border-radius: ${THEME_TOKENS.radiusMd} !important;
    padding: 10px 16px !important;
    font-size: 13px !important;
  }
  .swagger-ui .filter .operation-filter-input:focus {
    border-color: ${THEME_TOKENS.borderFocus} !important;
    box-shadow: 0 0 0 2px ${THEME_TOKENS.accentGlow} !important;
  }
  .swagger-ui .response_duration {
    color: ${THEME_TOKENS.get} !important;
    font-family: ${THEME_TOKENS.fontMono} !important;
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
  customfavIcon: 'https://img.icons8.com/color/48/film-reel.png',
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

/**
 * Single-call Express Integration Setup
 * Mounts interactive Swagger UI documentation at GET /docs and raw OpenAPI JSON spec at GET /docs.json
 *
 * @param app Express Application instance
 */
export function setupSwagger(app: Express): void {
  // Mount interactive Swagger UI docs at GET /docs
  app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, swaggerUiOptions)
  );

  // Expose raw OpenAPI JSON specification endpoint
  app.get('/docs.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(swaggerSpec);
  });
}

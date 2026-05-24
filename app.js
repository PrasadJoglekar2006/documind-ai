const state = {
  files: [],
  analysis: null,
  docs: {},
  activeDoc: "readme",
  prUpdates: [],
};

const selectors = {
  repoInput: document.querySelector("#repoInput"),
  demoButton: document.querySelector("#demoButton"),
  analyzeButton: document.querySelector("#analyzeButton"),
  stackTags: document.querySelector("#stackTags"),
  architectureList: document.querySelector("#architectureList"),
  dependencyList: document.querySelector("#dependencyList"),
  scoreValue: document.querySelector("#scoreValue"),
  scoreLabel: document.querySelector("#scoreLabel"),
  fileCount: document.querySelector("#fileCount"),
  apiCount: document.querySelector("#apiCount"),
  missingDocs: document.querySelector("#missingDocs"),
  apiTable: document.querySelector("#apiTable"),
  docPreview: document.querySelector("#docPreview"),
  tabs: document.querySelectorAll(".tab"),
  copyDocs: document.querySelector("#copyDocs"),
  downloadDocs: document.querySelector("#downloadDocs"),
  simulatePr: document.querySelector("#simulatePr"),
  prDiff: document.querySelector("#prDiff"),
  prResult: document.querySelector("#prResult"),
  chatForm: document.querySelector("#chatForm"),
  chatInput: document.querySelector("#chatInput"),
  chatLog: document.querySelector("#chatLog"),
};

const ignoredPathParts = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "__pycache__",
  ".venv",
  "venv",
  "coverage",
];

const codeExtensions = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".go",
  ".java",
  ".rb",
  ".php",
  ".cs",
  ".rs",
  ".md",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".env",
  ".example",
  "Dockerfile",
]);

function pathExt(path) {
  if (path.endsWith("Dockerfile")) return "Dockerfile";
  const match = path.match(/\.[a-z0-9]+$/i);
  return match ? match[0] : "";
}

function isUsefulFile(path, size = 0) {
  const normalized = path.replaceAll("\\", "/");
  if (ignoredPathParts.some((part) => normalized.includes(`/${part}/`) || normalized.startsWith(`${part}/`))) {
    return false;
  }
  if (size > 260000) return false;
  const ext = pathExt(normalized);
  return codeExtensions.has(ext) || normalized.includes(".env");
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function titleCase(value) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function createDemoFiles() {
  return [
    {
      path: "backend/main.py",
      content: `from fastapi import FastAPI
from app.routes import auth, payment

app = FastAPI(title="DocuMind Demo API")
app.include_router(auth.router, prefix="/auth")
app.include_router(payment.router, prefix="/payment")

@app.get("/health")
async def health_check():
    return {"status": "ok"}`,
    },
    {
      path: "backend/app/routes/auth.py",
      content: `from fastapi import APIRouter, Depends
from pydantic import BaseModel

router = APIRouter()

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/login")
async def login(payload: LoginRequest):
    return {"token": "jwt-token"}

@router.get("/me")
async def profile(user=Depends()):
    return user`,
    },
    {
      path: "backend/app/routes/payment.py",
      content: `from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class PaymentRequest(BaseModel):
    amount: int
    currency: str

@router.post("/checkout")
async def checkout(payload: PaymentRequest):
    return {"checkoutUrl": "https://payments.example/checkout"}`,
    },
    {
      path: "backend/app/services/docs_generator.py",
      content: `import os
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def generate_markdown(repo_context: str) -> str:
    response = client.responses.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
        input=repo_context,
    )
    return response.output_text`,
    },
    {
      path: "frontend/package.json",
      content: JSON.stringify(
        {
          scripts: { dev: "next dev", build: "next build", start: "next start" },
          dependencies: {
            next: "15.0.0",
            react: "19.0.0",
            "react-dom": "19.0.0",
            "react-markdown": "^9.0.0",
            axios: "^1.7.0",
            "lucide-react": "^0.468.0",
          },
          devDependencies: { tailwindcss: "^3.4.0", typescript: "^5.6.0" },
        },
        null,
        2,
      ),
    },
    {
      path: "frontend/app/api/analyze-repo/route.ts",
      content: `export async function POST(request: Request) {
  const body = await request.json()
  return Response.json({ jobId: "analysis_123", repository: body.repository })
}`,
    },
    {
      path: "frontend/app/dashboard/page.tsx",
      content: `export default function Dashboard() {
  return <main>Documentation dashboard and repository chat</main>
}`,
    },
    {
      path: "backend/requirements.txt",
      content: `fastapi
uvicorn
pydantic
openai
chromadb
langchain
tree-sitter
pygithub`,
    },
    {
      path: ".env.example",
      content: `OPENAI_API_KEY=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_WEBHOOK_SECRET=
DATABASE_URL=`,
    },
    {
      path: "Dockerfile",
      content: `FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]`,
    },
    {
      path: "README.md",
      content: `# DocuMind Demo

AI documentation generator MVP.`,
    },
  ];
}

async function readSelectedFiles(fileList) {
  const files = [...fileList].filter((file) => isUsefulFile(file.webkitRelativePath || file.name, file.size));
  const limited = files.slice(0, 400);
  const mapped = await Promise.all(
    limited.map(async (file) => ({
      path: file.webkitRelativePath || file.name,
      content: await file.text(),
    })),
  );
  return mapped;
}

function detectDependencies(files) {
  const dependencies = [];
  const packageFiles = files.filter((file) => file.path.endsWith("package.json"));
  for (const file of packageFiles) {
    const pkg = safeJsonParse(file.content);
    if (!pkg) continue;
    const combined = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    Object.keys(combined).forEach((name) => dependencies.push({ name, source: file.path, type: "npm" }));
  }

  for (const file of files.filter((item) => item.path.endsWith("requirements.txt"))) {
    file.content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => line.split(/[=<>~!]/)[0].trim())
      .forEach((name) => dependencies.push({ name, source: file.path, type: "python" }));
  }

  for (const file of files.filter((item) => item.path.endsWith("pyproject.toml"))) {
    const matches = [...file.content.matchAll(/["']([a-zA-Z0-9_.-]+)[<>=~!]/g)];
    matches.forEach((match) => dependencies.push({ name: match[1], source: file.path, type: "python" }));
  }

  return dependencies;
}

function detectFrameworks(files, dependencies) {
  const names = dependencies.map((item) => item.name.toLowerCase());
  const paths = files.map((file) => file.path.toLowerCase());
  const signals = [];
  const add = (name, reason) => signals.push({ name, reason });

  if (names.includes("next") || paths.some((path) => path.includes("/app/") || path.includes("/pages/"))) {
    add("Next.js", "package or app/pages routing files detected");
  }
  if (names.includes("react") || paths.some((path) => path.endsWith(".tsx") || path.endsWith(".jsx"))) {
    add("React", "React dependency or JSX/TSX files detected");
  }
  if (names.includes("vite") || paths.some((path) => path.endsWith("vite.config.ts") || path.endsWith("vite.config.js"))) {
    add("Vite", "Vite dependency or config detected");
  }
  if (names.includes("tailwindcss") || paths.some((path) => path.includes("tailwind.config"))) {
    add("Tailwind CSS", "Tailwind dependency or config detected");
  }
  if (names.includes("fastapi") || files.some((file) => file.content.includes("from fastapi import"))) {
    add("FastAPI", "FastAPI imports or dependency detected");
  }
  if (names.includes("flask") || files.some((file) => file.content.includes("from flask import"))) {
    add("Flask", "Flask imports or dependency detected");
  }
  if (names.includes("django") || paths.some((path) => path.includes("settings.py") || path.includes("urls.py"))) {
    add("Django", "Django dependency or conventional files detected");
  }
  if (names.includes("express") || files.some((file) => file.content.includes("express()"))) {
    add("Express", "Express dependency or app initialization detected");
  }
  if (names.includes("chromadb")) add("ChromaDB", "Vector database dependency detected");
  if (names.includes("langchain")) add("LangChain", "RAG orchestration dependency detected");
  if (names.includes("openai")) add("OpenAI API", "LLM SDK dependency detected");
  if (paths.some((path) => path.endsWith("dockerfile"))) add("Docker", "Dockerfile detected");

  return signals;
}

function detectRoutes(files) {
  const routes = [];
  const fastApiPrefixes = detectFastApiPrefixes(files);
  const addRoute = (method, path, source, notes = "Detected from route declaration") => {
    routes.push({
      method: method.toUpperCase(),
      path,
      source,
      notes,
    });
  };

  for (const file of files) {
    const lowerPath = file.path.toLowerCase();
    const isPython = lowerPath.endsWith(".py");
    const isJavaScript = /\.(js|jsx|ts|tsx)$/i.test(lowerPath);
    const lines = file.content.split(/\r?\n/);
    lines.forEach((line, index) => {
      const source = `${file.path}:${index + 1}`;
      const fastApi = isPython
        ? line.match(/@(?:app|router)\.(get|post|put|patch|delete)\(["'`]([^"'`]+)["'`]/i)
        : null;
      if (fastApi) {
        const routePath = line.includes("@router.")
          ? joinRoutePaths(fastApiPrefixes.get(moduleNameFromPath(file.path)) || "", fastApi[2])
          : fastApi[2];
        addRoute(fastApi[1], routePath, source, "FastAPI decorator");
      }

      const flask = isPython ? line.match(/@(?:app|blueprint)\.route\(["'`]([^"'`]+)["'`](.*)\)/i) : null;
      if (flask) {
        const methods = flask[2].match(/methods\s*=\s*\[([^\]]+)\]/i);
        const parsedMethods = methods ? [...methods[1].matchAll(/["'`]([A-Z]+)["'`]/g)].map((m) => m[1]) : ["GET"];
        parsedMethods.forEach((method) => addRoute(method, flask[1], source, "Flask route decorator"));
      }

      const express = isJavaScript ? line.match(/(?:app|router)\.(get|post|put|patch|delete)\(["'`]([^"'`]+)["'`]/i) : null;
      if (express) addRoute(express[1], express[2], source, "Express route handler");

      const django = isPython ? line.match(/path\(["'`]([^"'`]+)["'`]\s*,/i) : null;
      if (django) addRoute("GET", `/${django[1]}`, source, "Django URL pattern; method inferred");
    });

    const nextRoute = file.path.match(/(?:^|\/)app\/api\/(.+)\/route\.(ts|js)$/i);
    if (nextRoute) {
      const routePath = `/api/${nextRoute[1].replace(/\[[^\]]+\]/g, ":param")}`;
      const exports = [...file.content.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)/g)].map(
        (match) => match[1],
      );
      (exports.length ? exports : ["GET"]).forEach((method) => addRoute(method, routePath, file.path, "Next.js App Router"));
    }

    const pagesApi = file.path.match(/(?:^|\/)pages\/api\/(.+)\.(ts|js)$/i);
    if (pagesApi) {
      addRoute("ANY", `/api/${pagesApi[1].replace(/\[[^\]]+\]/g, ":param")}`, file.path, "Next.js Pages API");
    }
  }

  const seen = new Set();
  return routes.filter((route) => {
    const key = `${route.method}:${route.path}:${route.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function detectFastApiPrefixes(files) {
  const prefixes = new Map();
  for (const file of files) {
    const matches = file.content.matchAll(/include_router\(\s*([a-zA-Z_][\w]*)\.router\s*,\s*prefix\s*=\s*["'`]([^"'`]+)["'`]/g);
    for (const match of matches) {
      prefixes.set(match[1], match[2]);
    }
  }
  return prefixes;
}

function moduleNameFromPath(path) {
  return path.split("/").pop().replace(/\.[^.]+$/, "");
}

function joinRoutePaths(prefix, routePath) {
  const left = prefix ? `/${prefix.replace(/^\/|\/$/g, "")}` : "";
  const right = routePath ? `/${routePath.replace(/^\/|\/$/g, "")}` : "";
  return `${left}${right}` || "/";
}

function detectEnvVars(files) {
  const envVars = [];
  for (const file of files) {
    const patterns = [
      /process\.env\.([A-Z0-9_]+)/g,
      /import\.meta\.env\.([A-Z0-9_]+)/g,
      /os\.getenv\(["'`]([A-Z0-9_]+)["'`]/g,
      /getenv\(["'`]([A-Z0-9_]+)["'`]/g,
    ];
    patterns.forEach((pattern) => {
      [...file.content.matchAll(pattern)].forEach((match) => envVars.push({ name: match[1], source: file.path }));
    });
    if (file.path.toLowerCase().includes(".env")) {
      file.content.split(/\r?\n/).forEach((line) => {
        const match = line.match(/^([A-Z0-9_]+)=/);
        if (match) envVars.push({ name: match[1], source: file.path });
      });
    }
  }

  const seen = new Set();
  return envVars.filter((item) => {
    const key = item.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function detectFolders(files) {
  const folderCounts = new Map();
  files.forEach((file) => {
    const parts = file.path.split("/");
    parts.pop();
    let current = "";
    parts.slice(0, 3).forEach((part) => {
      current = current ? `${current}/${part}` : part;
      folderCounts.set(current, (folderCounts.get(current) || 0) + 1);
    });
  });
  return [...folderCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([folder, count]) => ({ folder, count, purpose: inferFolderPurpose(folder) }));
}

function inferFolderPurpose(folder) {
  const lower = folder.toLowerCase();
  if (lower.includes("route") || lower.includes("api")) return "API route handling";
  if (lower.includes("service")) return "Business logic and integrations";
  if (lower.includes("component")) return "Reusable UI components";
  if (lower.includes("page") || lower.includes("app")) return "Application pages and routing";
  if (lower.includes("test") || lower.includes("spec")) return "Automated tests";
  if (lower.includes("model") || lower.includes("schema")) return "Data models and validation";
  if (lower.includes("backend")) return "Server-side application code";
  if (lower.includes("frontend")) return "Client-side application code";
  return "Project source files";
}

function detectArchitecture(files, frameworks, routes) {
  const paths = files.map((file) => file.path.toLowerCase());
  const names = frameworks.map((item) => item.name);
  const architecture = [];

  if (paths.some((path) => path.startsWith("frontend/")) && paths.some((path) => path.startsWith("backend/"))) {
    architecture.push("Separate frontend and backend workspaces");
  }
  if (names.includes("Next.js")) architecture.push("File-based frontend routing with Next.js");
  if (names.includes("FastAPI")) architecture.push("Python API layer using FastAPI route decorators");
  if (names.includes("Express")) architecture.push("Node.js API layer using Express handlers");
  if (names.includes("ChromaDB") || names.includes("LangChain")) architecture.push("RAG-ready AI pipeline with embeddings or retrieval dependencies");
  if (routes.length) architecture.push("HTTP API surface detected from source code");
  if (paths.some((path) => path.includes("dockerfile"))) architecture.push("Containerized deployment path available");
  if (!architecture.length) architecture.push("Architecture could not be confidently inferred from the selected files");

  return architecture;
}

function detectSecurity(files, envVars) {
  const findings = [];
  const allContent = files.map((file) => file.content).join("\n");
  if (envVars.length) findings.push("Secrets are expected through environment variables; keep real values out of Git.");
  if (/password\s*[:=]\s*["'][^"']+["']/i.test(allContent) || /api[_-]?key\s*[:=]\s*["'][^"']+["']/i.test(allContent)) {
    findings.push("Possible hardcoded secret patterns found; review before production.");
  }
  if (/CORSMiddleware[\s\S]*allow_origins\s*=\s*\[\s*["']\*["']\s*\]/.test(allContent)) {
    findings.push("CORS appears permissive; restrict origins for production.");
  }
  if (/GITHUB_WEBHOOK_SECRET|X-Hub-Signature|x-hub-signature|hmac/i.test(allContent)) {
    findings.push("Webhook signature verification signals detected.");
  } else {
    findings.push("No webhook signature verification evidence found; add HMAC verification for GitHub webhooks.");
  }
  if (/Depends\(|JWT|OAuth|passport|next-auth|auth/i.test(allContent)) {
    findings.push("Authentication-related code is present; document auth requirements per endpoint.");
  }
  if (/pydantic|zod|joi|yup|class-validator/i.test(allContent)) {
    findings.push("Request validation libraries detected.");
  } else {
    findings.push("No strong validation library signal detected; validate external input explicitly.");
  }
  return unique(findings);
}

function detectUndocumented(files, routes) {
  const readmes = files.filter((file) => /readme\.md$/i.test(file.path));
  const docs = files.filter((file) => file.path.toLowerCase().startsWith("docs/") || file.path.toLowerCase().includes("/docs/"));
  const docContent = [...readmes, ...docs].map((file) => file.content).join("\n").toLowerCase();
  const missing = [];
  if (!readmes.length) missing.push("README.md is missing.");
  if (!docs.length) missing.push("No dedicated docs folder detected.");
  routes.forEach((route) => {
    if (!docContent.includes(route.path.toLowerCase())) {
      missing.push(`${route.method} ${route.path} is not referenced in current documentation.`);
    }
  });
  return missing;
}

function estimateScore(files, routes, envVars, undocumented, security) {
  let score = 52;
  if (files.some((file) => /readme\.md$/i.test(file.path))) score += 12;
  if (files.some((file) => file.path.toLowerCase().startsWith("docs/"))) score += 8;
  if (envVars.length) score += 6;
  if (routes.length) score += 8;
  if (files.some((file) => /dockerfile$/i.test(file.path))) score += 5;
  if (security.some((item) => item.includes("Request validation"))) score += 5;
  score -= Math.min(28, undocumented.length * 4);
  return Math.max(15, Math.min(98, score));
}

function analyzeRepository(files) {
  const dependencies = detectDependencies(files);
  const frameworks = detectFrameworks(files, dependencies);
  const routes = detectRoutes(files);
  const envVars = detectEnvVars(files);
  const folders = detectFolders(files);
  const architecture = detectArchitecture(files, frameworks, routes);
  const security = detectSecurity(files, envVars);
  const undocumented = detectUndocumented(files, routes);
  const score = estimateScore(files, routes, envVars, undocumented, security);

  return {
    dependencies,
    frameworks,
    routes,
    envVars,
    folders,
    architecture,
    security,
    undocumented,
    score,
    deployment: detectDeployment(files),
    modules: detectCoreModules(files),
  };
}

function detectDeployment(files) {
  const paths = files.map((file) => file.path.toLowerCase());
  const deployment = [];
  if (paths.some((path) => path.endsWith("dockerfile"))) deployment.push("Dockerfile available for container deployment.");
  if (paths.includes("vercel.json") || paths.some((path) => path.includes("next.config"))) deployment.push("Vercel is a likely frontend deployment target.");
  if (paths.includes("render.yaml")) deployment.push("Render configuration detected.");
  if (paths.some((path) => path.includes(".github/workflows/"))) deployment.push("GitHub Actions workflow detected.");
  if (!deployment.length) deployment.push("No deployment configuration found; add deployment docs before production.");
  return deployment;
}

function detectCoreModules(files) {
  const sourceFiles = files.filter((file) => !file.path.toLowerCase().endsWith("package.json"));
  return sourceFiles
    .filter((file) => {
      const lower = file.path.toLowerCase();
      return /(route|api|service|controller|model|schema|component|page|main|app)/.test(lower);
    })
    .slice(0, 14)
    .map((file) => ({
      path: file.path,
      purpose: inferFolderPurpose(file.path),
    }));
}

function generateDocs(analysis, files) {
  const projectName = inferProjectName(files);
  const stack = analysis.frameworks.map((item) => item.name).join(", ") || "Not confidently detected";
  const dependencies = analysis.dependencies.slice(0, 14).map((item) => `- \`${item.name}\` (${item.type}, from \`${item.source}\`)`);
  const folders = analysis.folders.map((item) => `- \`${item.folder}/\` - ${item.purpose} (${item.count} files scanned)`);
  const envVars = analysis.envVars.length
    ? analysis.envVars.map((item) => `- \`${item.name}\` - referenced in \`${item.source}\``)
    : ["- No environment variables were detected from the scanned files."];
  const routes = analysis.routes.length
    ? analysis.routes.map(
        (route) =>
          `| ${route.method} | \`${route.path}\` | \`${route.source}\` | ${route.notes}; request and response shapes should be confirmed from handler logic. |`,
      )
    : ["| -- | -- | -- | No HTTP routes were detected. |"];
  const modules = analysis.modules.length
    ? analysis.modules.map((module) => `- \`${module.path}\` - ${module.purpose}`)
    : ["- No core modules were confidently detected."];
  const assumptions = [
    "- API request and response examples are inferred only when route declarations are visible.",
    "- Authentication requirements are marked as assumptions unless middleware or dependency code is present near the route.",
    "- Files larger than 260 KB and generated folders are skipped to keep browser analysis fast.",
  ];

  const readme = `# ${projectName}

## Project Overview

${projectName} is a software project analyzed by DocuMind AI. This generated documentation summarizes the detected stack, architecture, APIs, setup requirements, deployment notes, security considerations, and likely documentation gaps.

## Tech Stack

${analysis.frameworks.map((item) => `- **${item.name}** - ${item.reason}`).join("\n") || "- No major framework was confidently detected."}

## Installation Guide

1. Clone the repository.
2. Install dependencies for each detected workspace.
3. Create a local environment file using the variables listed below.
4. Run the backend and frontend development commands from the project README or package scripts.

Detected dependency manifests:

${unique(analysis.dependencies.map((item) => `- \`${item.source}\``)).join("\n") || "- No dependency manifest was detected."}

## Folder Structure

${folders.join("\n")}

## Architecture Summary

${analysis.architecture.map((item) => `- ${item}`).join("\n")}

## API Documentation

| Method | Endpoint | Evidence | Notes |
| --- | --- | --- | --- |
${routes.join("\n")}

## Core Modules

${modules.join("\n")}

## Environment Variables

${envVars.join("\n")}

## Deployment Instructions

${analysis.deployment.map((item) => `- ${item}`).join("\n")}

## Recent Changes

${state.prUpdates.length ? state.prUpdates.map((item) => `- ${item}`).join("\n") : "- No pull request updates have been simulated yet."}

## Security Notes

${analysis.security.map((item) => `- ${item}`).join("\n")}

## Suggested Improvements

${analysis.undocumented.length ? analysis.undocumented.map((item) => `- ${item}`).join("\n") : "- Current documentation coverage looks healthy from the scanned evidence."}

## Assumptions

${assumptions.join("\n")}
`;

  const onboarding = `# Developer Onboarding Guide

## First-Day Setup

1. Install the runtime versions required by the detected stack: ${stack}.
2. Install dependencies from the detected manifests.
3. Configure local environment variables.
4. Start the development servers and verify the health or landing route.

## Project Structure

${folders.join("\n")}

## How The Application Is Likely Organized

${analysis.architecture.map((item) => `- ${item}`).join("\n")}

## Important Files To Read First

${modules.join("\n")}

## Business Logic Summary

Business logic appears to live in route, service, schema, and page modules. Review the core modules above first because they contain the strongest source-code signals.

## Documentation Gaps

${analysis.undocumented.length ? analysis.undocumented.map((item) => `- ${item}`).join("\n") : "- No major documentation gaps were detected."}
`;

  const api = `# API Documentation

## Overview

The following endpoints were detected directly from code. Examples are conservative because request and response bodies require deeper semantic analysis of each handler.

| Method | Endpoint | Source | Notes |
| --- | --- | --- | --- |
${routes.join("\n")}

## Example Request

\`\`\`bash
curl -X GET http://localhost:8000/health
\`\`\`

## Authentication

${analysis.security.some((item) => item.includes("Authentication"))
    ? "Authentication-related code was detected. Confirm exact auth middleware or dependency requirements per endpoint."
    : "No explicit authentication requirement was confidently detected from route declarations."}

## Status Codes

- \`2xx\` - Successful request.
- \`4xx\` - Client-side validation or authentication error.
- \`5xx\` - Server-side failure.
`;

  const deployment = `# Deployment Notes

## Detected Deployment Signals

${analysis.deployment.map((item) => `- ${item}`).join("\n")}

## Recommended Production Checklist

- Store secrets in the hosting provider secret manager.
- Configure GitHub webhook signature verification.
- Restrict CORS origins to trusted frontend domains.
- Run dependency installation and test commands in CI.
- Regenerate documentation after every merged pull request.

## Environment Variables

${envVars.join("\n")}
`;

  const changes = `# Recent Changes

${state.prUpdates.length ? state.prUpdates.map((item) => `- ${item}`).join("\n") : "- No pull request changes have been processed yet."}

## Automated Update Behavior

When a pull request adds or changes API routes, DocuMind AI updates API docs, onboarding notes, deployment notes, and the documentation health score.
`;

  return { readme, onboarding, api, deployment, changes };
}

function inferProjectName(files) {
  const packageFile = files.find((file) => file.path.endsWith("package.json"));
  if (packageFile) {
    const pkg = safeJsonParse(packageFile.content);
    if (pkg?.name) return titleCase(pkg.name);
  }
  const readme = files.find((file) => /readme\.md$/i.test(file.path));
  if (readme) {
    const heading = readme.content.match(/^#\s+(.+)$/m);
    if (heading) return heading[1].trim();
  }
  return "Repository Documentation";
}

function renderMarkdown(markdown) {
  const lines = markdown.split("\n");
  let html = "";
  let inList = false;
  let inCode = false;
  let codeBuffer = [];
  let tableBuffer = [];

  const flushList = () => {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
  };
  const flushTable = () => {
    if (!tableBuffer.length) return;
    const rows = tableBuffer.filter((line) => !/^\|\s*-+/.test(line));
    html += "<table>";
    rows.forEach((row, index) => {
      const cells = row
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());
      html += `<tr>${cells.map((cell) => `<${index === 0 ? "th" : "td"}>${inlineMarkdown(cell)}</${index === 0 ? "th" : "td"}>`).join("")}</tr>`;
    });
    html += "</table>";
    tableBuffer = [];
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCode) {
        html += `<pre><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`;
        codeBuffer = [];
        inCode = false;
      } else {
        flushList();
        flushTable();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuffer.push(line);
      continue;
    }
    if (line.startsWith("|")) {
      flushList();
      tableBuffer.push(line);
      continue;
    }
    flushTable();
    if (line.startsWith("# ")) {
      flushList();
      html += `<h1>${inlineMarkdown(line.slice(2))}</h1>`;
    } else if (line.startsWith("## ")) {
      flushList();
      html += `<h2>${inlineMarkdown(line.slice(3))}</h2>`;
    } else if (line.startsWith("### ")) {
      flushList();
      html += `<h3>${inlineMarkdown(line.slice(4))}</h3>`;
    } else if (line.startsWith("- ")) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inlineMarkdown(line.slice(2))}</li>`;
    } else if (/^\d+\.\s/.test(line)) {
      flushList();
      html += `<p>${inlineMarkdown(line)}</p>`;
    } else if (line.trim()) {
      flushList();
      html += `<p>${inlineMarkdown(line)}</p>`;
    }
  }
  flushList();
  flushTable();
  return html;
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function renderAll() {
  const analysis = state.analysis;
  if (!analysis) return;

  state.docs = generateDocs(analysis, state.files);
  selectors.fileCount.textContent = state.files.length;
  selectors.apiCount.textContent = analysis.routes.length;
  selectors.missingDocs.textContent = analysis.undocumented.length;
  selectors.scoreValue.textContent = `${analysis.score}`;
  selectors.scoreLabel.textContent =
    analysis.score >= 85 ? "Strong coverage" : analysis.score >= 65 ? "Needs updates" : "Documentation risk";

  selectors.stackTags.classList.remove("empty-state");
  selectors.stackTags.innerHTML =
    analysis.frameworks.length > 0
      ? analysis.frameworks
          .map((item, index) => `<span class="tag ${index < 3 ? "highlight" : ""}">${escapeHtml(item.name)}</span>`)
          .join("")
      : '<span class="tag">No major frameworks detected</span>';

  selectors.architectureList.innerHTML = analysis.architecture.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  selectors.dependencyList.innerHTML =
    analysis.dependencies.slice(0, 8).map((item) => `<li>${escapeHtml(item.name)}</li>`).join("") ||
    "<li>No dependency manifest detected</li>";

  selectors.apiTable.innerHTML = analysis.routes.length
    ? analysis.routes
        .map(
          (route) => `<tr>
            <td><span class="method ${route.method.toLowerCase()}">${escapeHtml(route.method)}</span></td>
            <td><code>${escapeHtml(route.path)}</code></td>
            <td>${escapeHtml(route.source)}</td>
            <td>${escapeHtml(route.notes)}</td>
          </tr>`,
        )
        .join("")
    : '<tr><td colspan="4">No APIs detected yet.</td></tr>';

  selectors.docPreview.innerHTML = renderMarkdown(state.docs[state.activeDoc]);
}

function setStatus(message) {
  selectors.stackTags.classList.add("empty-state");
  selectors.stackTags.textContent = message;
}

async function runAnalysis(files) {
  if (!files.length) {
    setStatus("Select a repository folder or load the demo repo first.");
    return;
  }
  setStatus("Analyzing repository files...");
  await new Promise((resolve) => setTimeout(resolve, 180));
  state.files = files;
  state.analysis = analyzeRepository(files);
  renderAll();
  addChatMessage("agent", `Analysis complete. I scanned ${files.length} files and found ${state.analysis.routes.length} API route signal(s).`);
}

function addChatMessage(type, text) {
  const message = document.createElement("div");
  message.className = `chat-message ${type}`;
  message.textContent = text;
  selectors.chatLog.appendChild(message);
  selectors.chatLog.scrollTop = selectors.chatLog.scrollHeight;
}

function answerQuestion(question) {
  const analysis = state.analysis;
  if (!analysis) return "Analyze a repository first, then I can answer using detected files, routes, and dependencies.";
  const lower = question.toLowerCase();
  if (lower.includes("auth")) {
    const authRoutes = analysis.routes.filter((route) => route.path.toLowerCase().includes("auth") || route.path.toLowerCase().includes("login"));
    return authRoutes.length
      ? `Authentication appears around ${authRoutes.map((route) => `${route.method} ${route.path}`).join(", ")}. Confirm middleware or dependency details in the listed source files before documenting strict auth rules.`
      : "I did not find explicit auth routes. Search for auth middleware, session handling, JWT helpers, or OAuth provider configuration next.";
  }
  if (lower.includes("api") || lower.includes("endpoint") || lower.includes("route")) {
    return analysis.routes.length
      ? `Detected endpoints: ${analysis.routes.map((route) => `${route.method} ${route.path}`).join(", ")}. The API table includes source-file evidence for each route.`
      : "No API routes were detected from the scanned files.";
  }
  if (lower.includes("deploy") || lower.includes("production")) {
    return analysis.deployment.join(" ");
  }
  if (lower.includes("setup") || lower.includes("install")) {
    return `Install dependencies from ${unique(analysis.dependencies.map((item) => item.source)).join(", ") || "the project manifests"}, then configure ${analysis.envVars.map((item) => item.name).join(", ") || "the required environment variables if any are documented"}.`;
  }
  if (lower.includes("folder") || lower.includes("structure")) {
    return analysis.folders.map((folder) => `${folder.folder}/: ${folder.purpose}`).join(" ");
  }
  if (lower.includes("security") || lower.includes("secret")) {
    return analysis.security.join(" ");
  }
  if (lower.includes("payment")) {
    const payment = analysis.routes.filter((route) => route.path.toLowerCase().includes("payment") || route.path.toLowerCase().includes("checkout"));
    return payment.length
      ? `Payment-related endpoints: ${payment.map((route) => `${route.method} ${route.path}`).join(", ")}. Review their handlers for provider integration and webhook requirements.`
      : "No payment-specific route was detected in the scanned source.";
  }
  return `The strongest architecture signals are: ${analysis.architecture.join(" ")} Documentation score is ${analysis.score}/100.`;
}

function simulatePullRequestUpdate() {
  if (!state.analysis) {
    setStatus("Analyze a repository before simulating PR documentation updates.");
    return;
  }
  const diff = selectors.prDiff.value;
  const diffPath = /@(?:app|router)\.(get|post|put|patch|delete)/i.test(diff)
    ? "pull-request.py"
    : /(?:app|router)\.(get|post|put|patch|delete)\(["'`]/i.test(diff)
      ? "pull-request.ts"
      : "pull-request.diff";
  const pseudoFiles = [{ path: diffPath, content: diff }];
  const newRoutes = detectRoutes(pseudoFiles).filter(
    (route) => !state.analysis.routes.some((existing) => existing.method === route.method && existing.path === route.path),
  );

  const updates = [];
  if (newRoutes.length) {
    newRoutes.forEach((route) => {
      state.analysis.routes.push({ ...route, source: `PR diff (${route.source})` });
      updates.push(`Added API documentation for ${route.method} ${route.path}.`);
    });
  } else {
    updates.push("Reviewed PR diff; no new route declarations were detected.");
  }
  updates.push("Refreshed Recent Changes and deployment notes.");
  state.prUpdates.unshift(...updates);
  state.analysis.undocumented = detectUndocumented(state.files, state.analysis.routes);
  state.analysis.score = estimateScore(
    state.files,
    state.analysis.routes,
    state.analysis.envVars,
    state.analysis.undocumented,
    state.analysis.security,
  );
  renderAll();
  selectors.prResult.innerHTML = updates.map((item) => `<div class="timeline-item">${escapeHtml(item)}</div>`).join("");
}

selectors.repoInput.addEventListener("change", async (event) => {
  const files = await readSelectedFiles(event.target.files);
  await runAnalysis(files);
});

selectors.demoButton.addEventListener("click", async () => {
  await runAnalysis(createDemoFiles());
});

selectors.analyzeButton.addEventListener("click", async () => {
  await runAnalysis(state.files);
});

selectors.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    selectors.tabs.forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    state.activeDoc = tab.dataset.doc;
    if (state.docs[state.activeDoc]) selectors.docPreview.innerHTML = renderMarkdown(state.docs[state.activeDoc]);
  });
});

selectors.copyDocs.addEventListener("click", async () => {
  const markdown = state.docs[state.activeDoc];
  if (!markdown) return;
  await navigator.clipboard.writeText(markdown);
  selectors.copyDocs.textContent = "Copied";
  setTimeout(() => {
    selectors.copyDocs.textContent = "Copy";
  }, 1200);
});

selectors.downloadDocs.addEventListener("click", () => {
  const markdown = state.docs[state.activeDoc];
  if (!markdown) return;
  const blob = new Blob([markdown], { type: "text/markdown" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${state.activeDoc}-documentation.md`;
  link.click();
  URL.revokeObjectURL(link.href);
});

selectors.simulatePr.addEventListener("click", simulatePullRequestUpdate);

selectors.chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const question = selectors.chatInput.value.trim();
  if (!question) return;
  addChatMessage("user", question);
  selectors.chatInput.value = "";
  addChatMessage("agent", answerQuestion(question));
});

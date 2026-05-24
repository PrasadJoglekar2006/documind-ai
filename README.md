# DocuMind AI

DocuMind AI is a hackathon MVP for an AI-powered technical documentation generator. It helps developers keep documentation aligned with the actual codebase by analyzing repository files, detecting APIs and architecture signals, generating markdown documentation, and simulating automatic pull request based documentation updates.

## Problem Statement

Developers often delay documentation work because it is repetitive and easy to forget during fast development cycles. This creates outdated API references, confusing onboarding, missing setup instructions, and poor maintainability.

## Solution

DocuMind AI turns documentation into a self-updating workflow. The app scans a repository, identifies important project signals, generates structured technical documentation, and demonstrates how merged pull requests can automatically update API docs and changelogs.

## Live Demo

GitHub Pages URL:

```text
https://PrasadJoglekar2006.github.io/documind-ai/
```

Repository:

```text
https://github.com/PrasadJoglekar2006/documind-ai
```

## Core Features

- Repository folder analyzer
- Framework and library detection
- Backend and frontend architecture summary
- API route detection with source evidence
- README, onboarding, API, deployment, and recent changes documentation generation
- Pull request diff simulation for automatic documentation updates
- Repository Q&A chat for setup, APIs, auth, payment logic, folders, deployment, and security
- Documentation health score
- Security and missing documentation notes

## Tech Stack

This MVP is intentionally lightweight and runs fully in the browser.

- HTML
- CSS
- JavaScript
- GitHub Pages for deployment

The product concept can later be extended with:

- Next.js frontend
- FastAPI backend
- OpenAI API or Gemini API
- ChromaDB for vector search
- GitHub OAuth and webhooks

## How It Works

1. The user selects a repository folder in the browser.
2. The app scans useful source, config, and documentation files.
3. It detects frameworks, dependencies, folders, environment variables, routes, deployment signals, and security notes.
4. It generates structured markdown documentation.
5. The user can simulate a pull request diff.
6. If a new API route is found, the documentation and API table update automatically.
7. The repository chat answers common developer onboarding questions from the analysis result.

## Demo Flow

1. Open the app.
2. Click **Load demo repo**.
3. Show detected tech stack, files scanned, APIs detected, and documentation score.
4. Open the generated documentation tabs.
5. Click **Simulate update** to demonstrate PR-based documentation updates.
6. Ask the repo chat: `Where is payment logic?`
7. Show the updated API count and generated explanation.

## Project Structure

```text
.
├── index.html
├── styles.css
├── app.js
└── README.md
```

## Main Files

### `index.html`

Defines the dashboard layout, upload controls, generated documentation area, API table, PR update simulator, and repository chat UI.

### `styles.css`

Contains the responsive dark developer-dashboard interface, cards, tables, markdown preview styling, and mobile layout.

### `app.js`

Contains the core browser-side logic:

- demo repository data
- file filtering
- dependency detection
- framework detection
- API route detection
- environment variable detection
- documentation generation
- PR diff simulation
- repository chat responses

## Installation

No dependency installation is required.

To run locally, open `index.html` directly in a browser or serve the folder with a simple local server:

```bash
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173
```

## Deployment

This project can be deployed on GitHub Pages.

1. Push the project to GitHub.
2. Open the repository settings.
3. Go to **Pages**.
4. Select **Deploy from a branch**.
5. Choose the `main` branch and `/root` folder.
6. Save and wait for GitHub Pages to publish the site.

## Security Notes

- The MVP runs locally in the browser and does not upload selected repository files to a server.
- Real production versions should verify GitHub webhook signatures.
- API keys should be stored only in secure environment variables.
- Repository access should use OAuth scopes with least privilege.
- Generated documentation should include source references to avoid hallucinated APIs.

## Suggested Improvements

- Add real GitHub OAuth integration.
- Add GitHub webhook support for merged pull requests.
- Add backend analysis for larger repositories.
- Add OpenAI or Gemini powered semantic documentation generation.
- Add vector search for deeper repository chat.
- Export generated docs as `README.md`, `API.md`, and onboarding files.
- Add CI/CD integration to regenerate docs after every merge.

## Hackathon USP

The strongest feature is real-time documentation updates from pull request changes. This demonstrates a future where documentation stays synchronized with code automatically.

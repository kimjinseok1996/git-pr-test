# Learnings - React Auto PR Setup

## Project Requirements
- React + TypeScript + Vite
- ESLint + Prettier
- Folder structure: components, pages, hooks, utils
- Git workflow: main (production), develop (PR base), feature/* branches
- Conventional commits with husky + commitlint
- Full automation script: npm run autopr
- AI-generated commit messages and PR content
- GitHub CLI integration

## Timestamps
Started: Wed Mar 04 2026
## [TIMESTAMP] Task 1: React + TypeScript Vite Project Setup
- Created package.json with dependencies: react, react-dom, typescript, vite, eslint, prettier
- Configured ESLint rules: react-refresh/only-export-components, react-in-jsx-scope off
- Configured Prettier: 2-space indent, singleQuote, trailingComma es5
- Folder structure created: src/components, src/pages, src/hooks, src/utils, public
- Entry points: index.html → src/main.tsx → src/App.tsx

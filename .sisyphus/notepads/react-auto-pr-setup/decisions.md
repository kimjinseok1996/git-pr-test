# Architectural Decisions

## Git Workflow
- main branch: production
- develop branch: base for all PRs
- feature/* branches: feature development

## Commit Strategy
- Conventional commits enforced via commitlint
- Allowed types: feat, fix, chore, refactor, docs, style

## Automation Strategy
- npm run autopr: full automation from code to PR
- AI generation: commit messages from git diff
- GitHub CLI (gh): PR creation

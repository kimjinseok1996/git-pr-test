
## [2026-03-04] Task 4: AutoPR Script
- Created scripts/autopr.js with full automation workflow
- AI commit message generation using OpenAI API with fallback
- Conventional commit type detection from git diff:
  - Analyzes file types, extensions, and diff content
  - Determines: feat, fix, chore, refactor, docs, style, test
  - Heuristics: new files → feat, bug keywords → fix, md files → docs
- Automatic git add, commit, push with branch tracking
- GitHub PR creation via gh CLI with populated template
- PR base: develop, body includes Summary/Changes/Files Changed sections
- Windows compatible Node.js implementation with proper path handling
- Error handling for: no changes, not on feature branch, API failures, gh not installed
- Usage: npm run autopr
- Script validates branch is not main/master/develop before creating PR
- Uses temp file for PR body to avoid command line length limits
- Colorized console output with ANSI codes for better UX
- Graceful fallback when OPENAI_API_KEY not set
- Package.json updated with "autopr" script entry

#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}`),
};

/**
 * Execute git command and return output
 */
function git(command, ignoreError = false) {
  try {
    return execSync(`git ${command}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    if (!ignoreError) {
      throw error;
    }
    return '';
  }
}

/**
 * Check if there are uncommitted changes
 */
function hasChanges() {
  const status = git('status --porcelain');
  return status.length > 0;
}

/**
 * Get current branch name
 */
function getCurrentBranch() {
  return git('branch --show-current');
}

/**
 * Get git diff statistics
 */
function getDiffStats() {
  return git('diff HEAD --stat');
}

/**
 * Get detailed git diff
 */
function getDiff() {
  return git('diff HEAD');
}

/**
 * Get list of changed files with their status
 */
function getChangedFiles() {
  const status = git('status --porcelain');
  const files = status.split('\n').filter(Boolean).map(line => {
    const statusCode = line.substring(0, 2).trim();
    const file = line.substring(3);
    let status = 'modified';
    if (statusCode === 'A' || statusCode === '??') status = 'added';
    else if (statusCode === 'D') status = 'deleted';
    else if (statusCode === 'M') status = 'modified';
    else if (statusCode === 'R') status = 'renamed';
    return { status, file };
  });
  return files;
}

/**
 * Determine conventional commit type from changes
 */
function determineCommitType(diff, files) {
  const diffLower = diff.toLowerCase();
  const fileExtensions = files.map(f => f.file.split('.').pop());
  
  // Check for documentation changes
  if (files.some(f => f.file.match(/\.(md|txt|rst)$/i)) || diffLower.includes('readme')) {
    return 'docs';
  }
  
  // Check for style/formatting changes
  if (diffLower.includes('prettier') || diffLower.includes('format') || 
      diffLower.includes('whitespace') || diffLower.includes('indent')) {
    return 'style';
  }
  
  // Check for test files
  if (files.some(f => f.file.match(/\.(test|spec)\.(ts|tsx|js|jsx)$/i))) {
    return 'test';
  }
  
  // Check for configuration changes
  if (files.some(f => f.file.match(/\.(json|yml|yaml|toml|config\.)$/i)) && 
      !files.some(f => f.file.includes('package.json'))) {
    return 'chore';
  }
  
  // Check for bug fix indicators
  if (diffLower.includes('fix') || diffLower.includes('bug') || 
      diffLower.includes('error') || diffLower.includes('issue')) {
    return 'fix';
  }
  
  // Check for refactoring
  if (diffLower.includes('refactor') || diffLower.includes('restructure') ||
      (files.every(f => f.status === 'modified') && !diffLower.includes('add'))) {
    return 'refactor';
  }
  
  // Check for new features (new files or added functionality)
  if (files.some(f => f.status === 'added') || diffLower.includes('add') || 
      diffLower.includes('implement') || diffLower.includes('create')) {
    return 'feat';
  }
  
  // Default to feat for additions, chore for everything else
  return files.some(f => f.status === 'added') ? 'feat' : 'chore';
}

/**
 * Generate commit message using OpenAI API
 */
async function generateCommitMessageWithAI(diff, commitType) {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    log.warning('OPENAI_API_KEY not set, using fallback message generation');
    return generateFallbackMessage(diff, commitType);
  }
  
  try {
    log.info('Generating commit message with AI...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates concise conventional commit messages. Generate ONLY the commit message, no explanations. Format: type: brief description (max 50 chars)',
          },
          {
            role: 'user',
            content: `Generate a conventional commit message for these changes. Use type "${commitType}".\n\nDiff:\n${diff.substring(0, 3000)}`,
          },
        ],
        max_tokens: 100,
        temperature: 0.7,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    const message = data.choices[0].message.content.trim();
    
    // Ensure it starts with the correct type
    if (!message.startsWith(commitType + ':')) {
      return `${commitType}: ${message.replace(/^[a-z]+:\s*/, '')}`;
    }
    
    return message;
  } catch (error) {
    log.warning(`AI generation failed: ${error.message}, using fallback`);
    return generateFallbackMessage(diff, commitType);
  }
}

/**
 * Fallback message generation without AI
 */
function generateFallbackMessage(diff, commitType) {
  const lines = diff.split('\n');
  const addedLines = lines.filter(l => l.startsWith('+')).length;
  const removedLines = lines.filter(l => l.startsWith('-')).length;
  
  const descriptions = {
    feat: 'add new feature',
    fix: 'fix issue',
    chore: 'update configuration',
    refactor: 'refactor code',
    docs: 'update documentation',
    style: 'apply formatting',
    test: 'add tests',
  };
  
  const stats = addedLines > removedLines ? `(+${addedLines - removedLines} lines)` : 
                removedLines > addedLines ? `(-${removedLines - addedLines} lines)` : '';
  
  return `${commitType}: ${descriptions[commitType] || 'update code'} ${stats}`.trim();
}

/**
 * Generate PR body from template
 */
function generatePRBody(commitMessage, diff, files) {
  const summary = commitMessage.replace(/^[a-z]+:\s*/i, '');
  
  // Generate changes list
  const changes = files.map(f => {
    const icon = f.status === 'added' ? '➕' : f.status === 'deleted' ? '➖' : '✏️';
    return `- ${icon} ${f.file}`;
  }).join('\n');
  
  // Get diff stats
  const stats = getDiffStats();
  
  const body = `## 🚀 Summary
${summary}

## 🔄 Changes
${changes}

## 📂 Files Changed
\`\`\`
${stats}
\`\`\`

## 🧪 Test Instructions

To verify these changes:
1. Pull this branch and run \`npm install\`
2. Run \`npm run dev\` to start the development server
3. Verify the changes work as expected

**Manual verification checklist:**
- [ ] Feature works as expected
- [ ] No breaking changes introduced
- [ ] Code follows project conventions
- [ ] Tests pass locally

---

**Reviewers:** Please check that the changes align with the summary above.`;
  
  return body;
}

/**
 * Check if gh CLI is available
 */
function isGhInstalled() {
  try {
    execSync('gh --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  log.section('🤖 AutoPR - Automated Commit and Pull Request');
  
  // Step 1: Check for changes
  log.info('Checking for uncommitted changes...');
  if (!hasChanges()) {
    log.error('No changes detected. Nothing to commit.');
    process.exit(1);
  }
  log.success('Changes detected');
  
  // Step 2: Get current branch
  const branch = getCurrentBranch();
  log.info(`Current branch: ${colors.bright}${branch}${colors.reset}`);
  
  if (branch === 'main' || branch === 'master' || branch === 'develop') {
    log.error(`Cannot create PR from ${branch} branch. Please create a feature branch first.`);
    process.exit(1);
  }
  
  // Step 3: Analyze changes
  log.section('📊 Analyzing Changes');
  const files = getChangedFiles();
  const diff = getDiff();
  const commitType = determineCommitType(diff, files);
  
  log.info(`Detected commit type: ${colors.bright}${commitType}${colors.reset}`);
  log.info(`Files changed: ${files.length}`);
  files.forEach(f => {
    const icon = f.status === 'added' ? '+' : f.status === 'deleted' ? '-' : '~';
    log.info(`  ${icon} ${f.file}`);
  });
  
  // Step 4: Generate commit message
  log.section('✍️  Generating Commit Message');
  const commitMessage = await generateCommitMessageWithAI(diff, commitType);
  log.success(`Generated: "${colors.bright}${commitMessage}${colors.reset}"`);
  
  // Step 5: Stage and commit
  log.section('💾 Committing Changes');
  try {
    git('add .');
    log.success('Staged all changes');
    
    git(`commit -m "${commitMessage.replace(/"/g, '\\"')}"`);
    log.success('Committed changes');
  } catch (error) {
    log.error(`Commit failed: ${error.message}`);
    process.exit(1);
  }
  
  // Step 6: Push branch
  log.section('🚀 Pushing Branch');
  try {
    // Check if upstream is set
    const upstream = git('rev-parse --abbrev-ref @{upstream}', true);
    
    if (!upstream) {
      git(`push --set-upstream origin ${branch}`);
      log.success(`Pushed and set upstream for ${branch}`);
    } else {
      git('push');
      log.success(`Pushed to ${upstream}`);
    }
  } catch (error) {
    log.error(`Push failed: ${error.message}`);
    process.exit(1);
  }
  
  // Step 7: Create PR
  log.section('🎉 Creating Pull Request');
  
  if (!isGhInstalled()) {
    log.error('GitHub CLI (gh) is not installed. Please install it to create PRs.');
    log.info('Download from: https://cli.github.com/');
    process.exit(1);
  }
  
  try {
    const prBody = generatePRBody(commitMessage, diff, files);
    const title = commitMessage;
    
    // Write body to temp file to avoid command line length issues
    const { writeFileSync, unlinkSync } = await import('fs');
    const { tmpdir } = await import('os');
    const tempFile = join(tmpdir(), `autopr-${Date.now()}.md`);
    writeFileSync(tempFile, prBody, 'utf-8');
    
    try {
      const prUrl = git(`!gh pr create --base develop --title "${title.replace(/"/g, '\\"')}" --body-file "${tempFile}"`);
      log.success(`Pull Request created: ${colors.bright}${prUrl}${colors.reset}`);
    } finally {
      unlinkSync(tempFile);
    }
  } catch (error) {
    log.error(`PR creation failed: ${error.message}`);
    log.info('Your changes have been committed and pushed. You can create the PR manually.');
    process.exit(1);
  }
  
  log.section('✅ AutoPR Complete!');
}

// Run main function
main().catch(error => {
  log.error(`Unexpected error: ${error.message}`);
  process.exit(1);
});

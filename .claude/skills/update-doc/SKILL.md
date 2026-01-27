---
name: update-doc
description: Transform documentation into AI-optimized format for Claude Code. Use when user says "update doc", "optimize doc", "rewrite for claude", or "AI optimize". Shows recently modified .md files for selection, verifies accuracy against codebase, generates optimized version, compares for completeness, then replaces with approval.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, Task
context: fork
---

# Update Doc

> Transform any markdown document into an AI-optimized version using research-backed best practices.

<when_to_use>

## When to Use

Invoke when user says:

- "update doc"
- "optimize doc"
- "rewrite for claude"
- "AI optimize"
- "make this doc AI-friendly"

</when_to_use>

<workflow>

## Workflow

| Phase | Action                                        | Gate          |
| ----- | --------------------------------------------- | ------------- |
| 0     | Find recent .md files, prompt user to select  | User select   |
| 1     | Read original, detect document type           | -             |
| 1.5   | Verify accuracy against codebase              | User choice   |
| 2     | Generate optimized version to `.optimized.md` | -             |
| 3     | Compare original vs optimized for gaps        | -             |
| 4     | Second pass: fill any gaps found              | -             |
| 5     | Present summary with key changes              | User approval |
| 6     | Replace original (with backup) or discard     | -             |

</workflow>

<phase_details>

## Phase Details

### Phase 0: File Selection

1. Use Glob to find `.md` files modified in last 30 days
2. Exclude: `node_modules/`, `.git/`, `*.optimized.md`, `*.backup.md`, `.next/`
3. Use AskUserQuestion to present top 10 most recently modified files
4. Store selected file path for subsequent phases

### Phase 1: Analysis

1. Read the selected document completely
2. Detect document type:

| Type         | Detection               | Key Transformations                  |
| ------------ | ----------------------- | ------------------------------------ |
| CLAUDE.md    | Filename                | < 300 lines, progressive disclosure  |
| Skill file   | `.claude/skills/` path  | Frontmatter, XML tags                |
| General      | `.md` extension         | Standard optimization                |

3. Count lines, headings, code blocks, links

### Phase 1.5: Accuracy Verification

For skill files and CLAUDE.md, verify content against codebase:

1. Use AskUserQuestion: "Verify accuracy against codebase first?"
2. If verifying, spawn Explore agent with Task tool:
   - Extract key claims (function names, file paths, commands)
   - Search codebase for actual implementations
   - Compare claims vs actual code
3. Fix inaccuracies before optimizing

### Phase 2: Transformation

Apply these transformation rules:

**Structure**:
- Strict heading hierarchy (H1 → H2 → H3, avoid H4+)
- Blockquote summary after H1 title
- Tables over prose
- Bullets over paragraphs
- Single topic per section

**Content**:
- Consistent terminology (no synonyms for same concept)
- Eliminate vague pronouns (it, this, that → specific nouns)
- Imperative form ("Run X" not "You should run X")

**Format**:
- XML tags for semantic sections
- Fenced code blocks with language identifier
- Target length based on document type

Write output to `[original-name].optimized.md` in same directory.

### Phase 3: Comparison

1. Extract all elements from original (headings, code, commands, links, facts)
2. Verify each element present in optimized (may be reformatted)
3. Create gap list of missing items

### Phase 4: Second Pass

For each gap identified:
1. Determine if omission was intentional (redundant, outdated)
2. If needed, add missing content to optimized document
3. Apply formatting rules to added content

### Phase 5: Summary

Present to user:

```markdown
## Optimization Summary

**Original**: [filename] ([X] lines)
**Optimized**: [filename].optimized.md ([Y] lines)
**Reduction**: [Z]%

### Key Changes
1. [Change 1]
2. [Change 2]
3. [Change 3]

### Content Verified
- Headings: [count] preserved
- Code examples: [count] intact
- Commands: [count] included
```

### Phase 6: Finalization

Based on user choice:
- **Replace**: Rename original to `.backup.md`, rename optimized to original name, then delete the backup
- **Keep both**: Leave both files in place
- **Discard**: Delete `.optimized.md`, keep original unchanged

</phase_details>

<approval_gates>

## Approval Gates

| Gate      | Phase | Question                                            |
| --------- | ----- | --------------------------------------------------- |
| Selection | 0     | "Which file do you want to optimize?"               |
| Accuracy  | 1.5   | "Verify accuracy against codebase first?"           |
| Replace   | 5     | "Replace original? / Keep both? / Discard changes?" |

</approval_gates>

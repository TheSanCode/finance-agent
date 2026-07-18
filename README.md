# finance-agent
the san code finance agent

## Commit Hook: Comment Sync Check

This repository includes a pre-commit hook that inspects staged changes and blocks a commit when code changed but no comment updates were staged in the same file.

### What it checks
- Looks at staged files only.
- Targets common code files: `.py`, `.sh`, `.js`, `.jsx`, `.ts`, `.tsx`, `.java`, `.go`, `.rs`, `.c`, `.h`, `.cpp`, `.hpp`, `.cs`.
- Fails if a file has non-comment code changes and zero staged comment-line changes.

### Enable hooks for this repo
Run this once from the repository root:

```powershell
git config core.hooksPath .githooks
```

### Bypass (temporary)

```powershell
$env:SKIP_COMMENT_CHECK=1
git commit -m "your message"
Remove-Item Env:SKIP_COMMENT_CHECK
```

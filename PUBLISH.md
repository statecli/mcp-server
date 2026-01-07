# Publishing StateCLI

## Pre-Publication Checklist

- [ ] Update version in `package.json`
- [ ] Run tests: `npm test`
- [ ] Build: `npm run build`
- [ ] Update CHANGELOG.md

## NPM Publication

```bash
# Login to NPM
npm login

# Publish (first time)
npm publish --access public

# Publish (updates)
npm version patch  # or minor, major
npm publish
```

## GitHub Repository Setup

1. Create GitHub organization: `statecli`
2. Create repository: `mcp-server`
3. Push code:

```bash
git init
git add .
git commit -m "Initial commit: StateCLI MCP Server v0.1.0"
git branch -M main
git remote add origin https://github.com/statecli/mcp-server.git
git push -u origin main
```

## Registry Submissions

### 1. Official MCP Registry
- URL: https://github.com/modelcontextprotocol/servers
- Submit PR to add StateCLI to the list

### 2. Smithery
- URL: https://smithery.ai
- Submit your MCP server for listing

### 3. Glama
- URL: https://glama.ai/mcp/servers
- List StateCLI

## Post-Publication

1. Verify NPM package: `npx statecli-mcp-server --help`
2. Test MCP integration with Claude Desktop
3. Create release on GitHub
4. Announce on social media

## Version Bumping

```bash
# Patch (0.1.0 -> 0.1.1)
npm version patch

# Minor (0.1.0 -> 0.2.0)
npm version minor

# Major (0.1.0 -> 1.0.0)
npm version major
```

## Secrets Required for CI/CD

Add to GitHub repository secrets:
- `NPM_TOKEN`: Your NPM access token for automated publishing

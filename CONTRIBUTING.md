# Contributing to SVG Button

Please use the [security policy](SECURITY.md) to report potential vulnerabilities privately.

## Open an issue first

Search the [existing issues](https://github.com/drantunes/svgbutton/issues) to avoid duplicates. If there is already an issue for your change, use that discussion. Otherwise, [open an issue](https://github.com/drantunes/svgbutton/issues/new) before starting work.

For a bug, include steps to reproduce it, the expected and actual behavior, and the button URL or a minimal SVG if relevant. For a feature, describe what you want to do and how the proposed change would help.

## Make and test your change

Use Node.js 24.14 or newer. Create a branch from `main` in your fork or in this repository if you have write access. Keep the changes focused on the issue.

```sh
npm ci
npm run dev
```

Open [localhost:8787](http://localhost:8787/) to try the editor. Before opening a pull request, run the checks below.

```sh
npm run lint
npm run check
npm test
npm run deploy:check
```

For editor changes, install the Chromium headless shell with `npx playwright install --only-shell chromium` and run `npm run test:browser`. On Linux, add `--with-deps` if you need the system dependencies.

## Open a pull request

Push your branch and open a pull request targeting `main`. Describe what changed and how you verified it. Add `Closes #123` with the issue number if the pull request resolves it. Otherwise, link the issue for context. Include a screenshot when it helps show an editor change.

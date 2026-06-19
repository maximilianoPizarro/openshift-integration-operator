# Contributing to OpenShift Integration Operator

First off, thank you for considering contributing to OpenShift Integration Operator! It's people like you that make OpenShift Integration Operator such a great tool.

## Contributor Ladder

We welcome contributors of all levels. As you contribute, you can grow your responsibilities in the project. Our contributor ladder is designed to give you a clear path:

### 1. Contributor
A contributor is anyone who has submitted a PR, opened an issue, or improved documentation.
- **Responsibilities**: Submit quality PRs, report bugs, help answer questions.
- **Requirements**: Read and follow the `CODE_OF_CONDUCT.md` and this `CONTRIBUTING.md` guide.

### 2. Reviewer
Reviewers are active contributors who are familiar with the codebase and are trusted to review PRs.
- **Responsibilities**: Review PRs from other contributors for quality, style, and correctness.
- **Requirements**: Demonstrated history of quality contributions and reviews. 

### 3. Maintainer (The Commit Bit)
Maintainers have write access to the repository (the "commit bit") and can merge PRs. They are also responsible for project governance and releases.
- **Responsibilities**: Merge PRs, manage releases, shape the roadmap, mentor contributors.
- **How the commit bit is granted**: 
  - To become a maintainer, you must demonstrate a sustained history of quality contributions and active participation in the community.
  - You must be nominated by an existing maintainer.
  - The existing maintainers will hold a vote (typically lazy consensus) to grant maintainer status.

## How to Contribute

- **Operator Code**: See the README for instructions on building and running the operator locally (`mvn quarkus:dev`).
- **Flows**: See `docs/contributing.html` for contributing new flows to the catalog.
- **Issues**: Search existing issues before opening a new one. Provide reproducible steps for bugs.
- **Pull Requests**: Keep PRs focused. Write clear commit messages. Ensure tests and linting pass.
- **Tests for new features**: When adding major operator, Helm, or console-plugin functionality, include or extend automated coverage (for example `mvn test`, workflow validation, or `helm lint`) so CI stays green before merge.

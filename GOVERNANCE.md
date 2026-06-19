# Governance

This document defines the governance process for the OpenShift Integration Operator project.

## Project Roles

Please see `CONTRIBUTING.md` for our Contributor Ladder (Contributor -> Reviewer -> Maintainer).

## Decision Making

We make decisions through **Lazy Consensus**. This means that when a proposal is made, it is considered accepted if no maintainer objects within a reasonable timeframe (typically 72 hours on weekdays). 

If there is an objection, we discuss it and attempt to reach a consensus. If consensus cannot be reached, the maintainers will hold a vote. A simple majority of maintainers is required to pass a vote.

## Merging Pull Requests

- **Who can merge**: Only Maintainers have write access and can merge Pull Requests.
- **Requirements for merging**:
  - The PR must have at least one approval from a Reviewer or Maintainer (other than the author).
  - All CI tests must pass.
  - Trivial changes (e.g., fixing a typo) can be self-merged by maintainers under lazy consensus.

## Adding External Maintainers

As we prepare for CNCF/ASF incubation, we are actively looking to diversify our maintainer base.
- We plan to add external maintainers from multiple organizations to avoid single-vendor dependency.
- Contributors who demonstrate sustained participation and align with the project's goals can be nominated as Maintainers.
- See `CONTRIBUTING.md` for the criteria to become a Maintainer.

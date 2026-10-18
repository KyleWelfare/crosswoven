# Coding standards

## Modules and naming

- One module per concept, named after the concept as a noun: `level.ts`, `validator.ts`, not `config.ts` or `utils.ts`. A type lives in the module that owns its concept
- File names are kebab-case: `level-decoder.ts`. Case-insensitive filesystems on Windows and macOS hide case-only renames that then break on Linux CI
- Types are PascalCase; functions, variables and properties camelCase; top-level constants camelCase or UPPER_CASE. ESLint enforces this

## Types

Annotate every function return, parameter and variable, even where TypeScript could infer it. Agents read the type at the declaration instead of inferring it. ESLint enforces this.

## Comments

Don't comment what the code already says. If a competent developer or agent can work it out by reading the code, leave the comment out.

Comment only what can't be discerned from the code:

- Hidden context: product or design decisions, constraints, engine or browser quirks, why a non-obvious approach was chosen
- TODOs, with enough detail to act on
- Units or invariants that the types don't express

No restating the next line, no section narration, no comments that repeat a name. If a comment feels needed to explain what code does, rename or restructure first.

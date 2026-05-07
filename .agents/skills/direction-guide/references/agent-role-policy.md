# Agent Role Policy

Use this policy before creating or recommending any new custom agent role. The goal is to prevent unnecessary custom-agent sprawl and keep routing decisions easy to audit.

## Baseline Roles

Start with these roles only:

- `explorer`
- `implementer`
- `verifier`
- `fixer`
- `integrator`
- `security-reviewer`

Do not add new roles until the same task type repeats 3 to 5 times and the baseline roles plus skills/reference docs have proven insufficient.

## Prefer Skills First

Prefer skills and reference docs before adding new personas. If the need is mainly extra domain knowledge, workflow steps, checklist language, or output examples, add or improve a skill/reference document instead of creating another agent role.

## New Role Requirements

Every new role requires:

- a clear routing rule;
- a required output schema;
- acceptance criteria for when the role's work is complete.

Do not add a role whose name sounds useful but does not change tools, instructions, or output.

## Roles Not To Add Yet

Do not add these roles yet:

- `architect`
- `product-manager`
- `frontend-agent`
- `backend-agent`
- `database-agent`
- `refactor-agent`
- `performance-agent`
- `documentation-agent`
- `release-agent`

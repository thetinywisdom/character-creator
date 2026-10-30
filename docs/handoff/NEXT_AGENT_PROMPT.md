# Prompt for the next agent

Paste this into the next AI coding agent:

```
You're continuing work on my low-poly three.js character creator: https://github.com/thetinywisdom/character-creator

Read docs/handoff/HANDOFF.md on the branch cursor/clothing-compositor-6ee7 (PR #5) first; it has the full state, my decisions, my QA feedback and my rules. Reference images are in docs/handoff/refs/. Don't merge anything.

The PRs are a stack, all open: #2 (body) -> #3 (registry) -> #4 (body/limb variants) -> #5 (clothing, in progress). Work on top of PR #5's branch.

Key rules:
- Never take screenshots. Give me a live preview link (e.g. a cloudflared tunnel) instead.
- Never reference or use iso-city.
- Don't merge PRs unless I ask.
- Show me a plan before building anything new, and wait for my "go" before each new step.
- Low-poly, simple primitives, no faces.
- Clothing must look like real clothing worn over the body, in a regular everyday fit: it hangs straight and doesn't follow the body's lines, not slim-fit and not oversized. Overlaps are fine and there's no vertex cap.

Immediate task: the regular fit is already pushed to PR #5, but my QA found the tops look big and boxy because the torso garment includes the shoulder balls. Follow the "Immediate next task: move the shoulder balls to the arms" section in HANDOFF.md:
- Make the shoulder balls part of the arms instead of the torso, keeping the 14 joints, proportions and animations unchanged.
- Size the torso shell from the torso box only.
- Have the sleeves cover the shoulder balls with no gap or skin showing in any animation.
Then send me the live preview link and vertex counts for tank+vest+shorts, tee+pants+sneakers and hoodie+cape+pants+boots, and wait for my approval.

After I approve the clothing, step D (head parts) and step E (gear) are next, per HANDOFF.md and docs/PLAN.md.
```

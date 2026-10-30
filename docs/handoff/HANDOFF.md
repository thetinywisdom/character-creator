# Character Creator: Handoff (updated 2026-10-29, 22:30 JST)
Reference images: docs/handoff/refs/ (anatomy.jpg = owner's hand-drawn mannequin anatomy, joints-sketch.jpg = joint sketch, ref-wooden-mannequin.png = reference mannequin, tee-sketch.jpg = owner's tee silhouette sketch, clothes-bad.png = first rejected clothing attempt). Next-agent prompt: docs/handoff/NEXT_AGENT_PROMPT.md.

Work was stopped at 93% weekly usage. This document records where the project stands so another agent can continue.

## Project
- Repo: https://github.com/thetinywisdom/character-creator (public). The permanent preview is GitHub Pages from the orphan `gh-pages` branch, not from `main`.
- Goal: a reusable, modular low-poly three.js character creator for future web games. It ships as a JS package with three.js as a peer dependency, uses code-driven animation, and has no glTF export.
- Plan: `docs/PLAN.md` (committed on the PR #3 branch and above).

## PR stack (all OPEN, nothing merged; do not merge unless the owner asks)
| PR | Branch | Step | State |
|---|---|---|---|
| [#2](https://github.com/thetinywisdom/character-creator/pull/2) | `cursor/low-poly-base-body-6ee7` | Base wooden-mannequin body and 19 animation clips | Done |
| [#3](https://github.com/thetinywisdom/character-creator/pull/3) | `cursor/character-registry-6ee7` | A: registry, versioned JSON document, `createCharacter` | Done |
| [#4](https://github.com/thetinywisdom/character-creator/pull/4) | `cursor/proportions-limbs-6ee7` | B: body presets, belly, robot torso, L/R arms, legs and hands, walk styles | Done |
| [#5](https://github.com/thetinywisdom/character-creator/pull/5) | `cursor/clothing-compositor-6ee7` (regular-fit commit pushed after `47cd0b6`) | C: clothing | **In progress** |
| #1 | (old) | Superseded foundation, the source of the ported clips | Leave unmerged |

Each PR is stacked on the one above it.

## What's built
- **Body** (`src/body/createBody.js`, `params.js`, `index.js`): a classic wooden artist's mannequin with no clavicle and 14 joints (neck, waist, and on each side the shoulder, elbow, wrist, hip, knee and ankle).
  - The joint balls are low-vertex (8×6), as wide as the thickest connected segment, hidden inside the limbs when straight and visible on the outer side of a bend.
  - The head uses the old lathe head shape (not an egg). The box torso and trapezoid pelvis have softly bevelled edges.
  - Naked: 1421 vertices, 1868 triangles.
  - API: `{ root, pelvis, joints, materials, update, setParams, getParams, getResolved, getStats }`.
- **Animation:** 19 clips with about a 0.2 s crossfade.
  - Movement: idle, walk (blends into run from 3.4 to 5.4 m/s), jump, crouch.
  - Actions: slap, hit, hit-r, knockdown, knockback, pose.
  - Dances: robot, chicken, disco, sprinkler, flail, hula, flex, bad.
- **Registry (A):** `registerSlot` and `registerPart`, a version 1 nested JSON document with `validateDocument` and `defaultDocument`, and `createCharacter(doc)`.
  - Sockets: head, back, gripL/R, wristItemL/R.
  - Copy and paste JSON. The panel sections are generated from the registry.
- **Body and limbs (B):**
  - Presets: man/woman and slim/average/broad/heavy. Belly slider.
  - A robot torso, which can't wear tops or outer layers.
  - Left and right arms: normal, muscular, robot, skeleton.
  - Hands: open, fist, claw, hook.
  - Legs: normal, robot, peg.
  - Walk styles: stomp, swagger.
- **Clothing (C, in progress):**
  - Slots: top (tank, tee, shirt, hoodie), outer (vest, jacket, cape), bottom (shorts, pants, skirt), shoes (barefoot, sneakers, boots, flats).
  - The naked body stays underneath, and overlaps are allowed.
  - Current state: regular fit (see Latest status). The tee is one straight block from the shoulders to just below the hips with short sleeve tubes over the shoulder balls.
  - Vertices: tank+vest+shorts 1675, tee+pants+sneakers 1925, hoodie+cape+pants+boots 2214.
  - Robot and skeleton limbs skip sleeves and pant tubes. Peg legs skip pant tubes and shoes.

## Latest status (2026-10-29, 22:30 JST)
- The regular-fit pass is **done and pushed** to PR #5 (`cursor/clothing-compositor-6ee7`). It finished just before the stop.
  - Garments sit about 2 cm off the shoulder span and chest and hang straight to just below the hips (no waist taper). There's a slight shoulder drop, and straight sleeves overlap the shoulder ball.
  - Pants are straight-leg (shin tube as wide as the thigh). The skirt is a modest A-line. The hoodie and jacket are about 1 cm roomier. Shoes have a small margin.
- The owner has QA'd it on a live preview. The clothing is **not approved yet**. See the feedback below.

## Owner QA feedback on the regular fit (must fix next)
> "I think it looks wrong because the clothes for the torso is including the shoulder balls. That is why when the clothes drape, it looks really big and boxy."

Diagnosis: the torso garment's width is taken from the outer edges of the shoulder balls, so the whole top block is as wide as both shoulder balls and hangs from there. That makes the top look oversized and boxy.

## Immediate next task: move the shoulder balls to the arms
The owner said: "In the next iteration, shoulder balls should be part of the arms, instead of torso."
- **Body:** treat each shoulder ball as part of the arm (the upper-arm segment and part set), not the torso. That includes body part ownership and grouping and the measurements the garments use. The 14-joint mannequin, its proportions and its animation must stay the same.
- **Tops and outer layers:** size the torso shell from the torso box only (its width at the shoulder line, not across the shoulder balls), still a regular fit hanging straight to just below the hips.
- **Sleeves:** the sleeve tube now covers the shoulder ball, as part of the arm garment. It must close cleanly against the torso shell, with no gap and no skin showing during walk, dance or arm raises.
- Robot and skeleton arms (which skip sleeves) and the robot torso (no tops) must still work with the new grouping.
- Then give the owner a fresh live preview link (no screenshots) and vertex counts for tank+vest+shorts, tee+pants+sneakers and hoodie+cape+pants+boots, and wait for approval before step D.

## Remaining plan after C
- **D: head parts.** 4 head shapes, hair (`none`, `buzz`, `bob`, `ponytail`, `long`, `afro`), facial hair, and headwear (`none`, `cap`, `beanie`, `hat`, `helmet`, `headband`). Hair isn't drawn under a covering hat or a hood. No ears, earrings, or eyewear.
- **E: gear.** One back slot, held items in gripL/R (holding an item turns an open hand into a fist), and wrist items, bands and cuffs.
- Also deferred: a separate robot-torso metal color and default dance autoplay.

## Owner decisions
- One back slot.
- 4 head shapes and 6 hair styles for v1. No ears, earrings, or eyewear.
- A robot torso can't wear tops.
- No dress part: a dress is a top plus a skirt.
- Holding an item turns an open hand into a fist.

## Owner rules (important)
- Review the plan with the owner before building. Go step by step and wait for "go" before each new step.
- **Never take screenshots.** Always give the GitHub Pages preview instead. Do not start a cloudflared tunnel; it dies when the VM sleeps.
- **Never reference or use iso-city** unless asked. Reuse earlier character-creator work (such as PR #1) instead.
- Don't merge PRs unless asked.
- Style: low-poly, simple primitives, no faces, smooth-reading joints.
- Clothing:
  - It must look like real clothing worn over the body: closed shells and a regular fit that hangs straight and doesn't trace body lines.
  - Not plain crates, not open planes, not slim-fit.
  - The vertex cap for clothing was dropped. Appearance comes first.

## GitHub Pages preview
The shareable preview is https://thetinywisdom.github.io/character-creator/ . Root is always the newest stack step. Each stack PR is also published under `/prN/` (PR #6 is https://thetinywisdom.github.io/character-creator/pr6/). Publishing does not merge anything.

After every push to a stack PR branch, rebuild and update the orphan `gh-pages` branch. Do not commit the built files, or a Vite `base` change, onto the PR branch.

1. From that PR commit, run `npx vite build --base ./`. The relative base makes the JS, CSS, and the bundled three.js module load under both `/character-creator/` and `/character-creator/prN/`.
2. On `gh-pages`, replace the root with that `dist/` and copy the same files into `/prN/`. Keep a `.nojekyll` file at the root of `gh-pages`.
3. Commit and push `gh-pages` only.

Pages must use the `gh-pages` branch and the `/ (root)` folder. The cloud agent token cannot change that setting: `PUT /repos/thetinywisdom/character-creator/pages` returns 403 `Resource not accessible by integration`. Until an owner saves it, https://thetinywisdom.github.io/character-creator/ is GitHub's "Site not found" page. Set it at Settings → Pages → Build and deployment → Deploy from a branch → Branch `gh-pages`, folder `/ (root)` → Save.

## Running the preview locally
Check out the top branch, install dependencies, and run `npm run dev` (http://localhost:5173). The shareable link is the GitHub Pages URL above.

## Known issues and open questions
- The clothing fit is still being tuned. Previous attempts were rejected for open planes, shrink-wrapped tapering, boxes that were open on top and a floating hood.
- Limb nudging still uses the chest and pelvis volume, not the garment shells.
- The robot torso uses the skin color.

# Style brief

Source: the attached turnaround sheets (hands, heads, front, side, back, walk) and `palette.json`. The figures are flat construction drawings for a tiny isometric city. They are judged small, from above, so the silhouette matters more than detail.

## Proportion

At a full height of 1, the head is about 0.15 tall and 0.12 wide. The neck is short, about 0.04, and about half the head width. The torso is one straight column from the shoulder line to the crotch (crotch near 0.65). It does not pinch at the waist. Front width of the torso is about 0.17 of height. Side depth is close to that width: the body is a thick rounded column, not a flat board. Hips are only a little wider than the chest. Legs are the bottom third, thighs apart by a small gap. Arms hang just clear of the hips, hands ending near the wrist-to-thigh line.

## Limbs, hands, feet

Limbs are smooth tapers, not faceted sticks and not separate shoulder balls in the silhouette. An upper arm is about 0.054 of height across and narrows to about 0.06 of that at the wrist. A thigh is about 0.076 across and narrows to about 0.05 at the ankle. Hands are chubby rounded mitts with a blunt end, held close to the thigh, not pointed paddles. Feet are low rounded ovals, longer than they are wide, with no toes. Shoes are the same oval, a little larger, in one dark color.

## Head and hair

The head is a smooth egg, widest through the cheeks, with a soft crown and a small chin. No eyes, nose, mouth, or brows. Ears are not separate parts; the oval is the silhouette. Hair is a solid rounded mass in one color:

- buzz: a short cap on the upper head
- afro: a ball sitting on the crown, face still clear
- bob: a cap plus a thick mass to the jaw
- ponytail: a cap plus a short tail down the back
- long: the same mass continued past the shoulders

Hats stay simple rounded caps. Glasses, finger creases, and the small facial strokes in the sheet are line details and are not modeled.

## Clothes

Everyday clothes hang straight off the shoulder line with a little ease. A shirt has a collar, a center opening, and sleeves to the wrist. A tee is a short-sleeve block with a slight curved hem. Pants are straight. A skirt is a modest A-line. An open jacket does not hide the top. Nothing is slim-fit and nothing traces the waist.

## Palette

Six ramps of five, dark to light, from `palette.json`:

| Ramp | Hex |
| --- | --- |
| Blue | `#203A57` `#2A5B94` `#3B7EE1` `#B0E9FF` `#DBF5FE` |
| Pink | `#A92D59` `#FF5491` `#FF7DAF` `#F8C0C5` `#F9F0F1` |
| Teal | `#194A4C` `#198085` `#00B4BC` `#A8ECF2` `#EFFAFA` |
| Warm | `#4C3F42` `#93616B` `#DF9E89` `#F1CDC3` `#FCF0ED` |
| Neutral | `#292C2E` `#363E47` `#5B6A7B` `#A7BFA4` `#F0F2F4` |
| Yellow | `#ED8F02` `#FFCC3F` `#FFE166` `#FFF3C1` `#FCF9EB` |

Defaults from those ramps: skin `#F1CDC3`, hair and shoes `#292C2E`, pants and headwear `#363E47`, shirts `#F0F2F4`. The preview background is the warm paper `#FCF9EB`, so a white shirt still reads without an ink outline.

## Shading and line

Fills are flat. The sheets use a thin outline a little darker than the fill, and no gradients, no cast shadows, and no texture. In the preview the skin and cloth use even Lambert shading with the tone map off, so a hex stays close to the swatch. Forms stay smooth (shared normals) so an 8-sided limb reads as a round tube at city size. There is no ink outline mesh.

## City camera

The sheets themselves are orthographic front and side views. The city view is orthographic too, at 45° azimuth and 30° elevation, framed so a standing figure is about a fifth of the view height.

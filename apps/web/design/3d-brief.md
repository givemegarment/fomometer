# 3D renders for fomometer.xyz

Style reference: https://1wintoken.com (photoreal studio 3D, glass and brushed metal, soft studio light,
shallow depth of field, saturated but calm color fields). Copy the look only: no 1win logo, coin or casino objects.

Shared style suffix (append to every prompt):
"photorealistic 3D render, studio lighting, soft reflections, frosted glass and brushed aluminium,
shallow depth of field, clean composition, no text, no logos, no people, 8k detail"

Brand: background #141415, brand green #00B24B (glow and accents only), neutral greys.
The product mark is a three-step meter: three bars of rising height, the tallest one green.

| # | Slot (component) | Aspect | Prompt |
|---|---|---|---|
| 1 | Hero background (`landing/hero.tsx`), also OG image | 16:9, 4K | A dark studio floor with a long row of frosted glass bars of different heights receding into the distance, a few of the tallest bars glowing emerald green from inside, thin light trails running between them, deep charcoal background #141415, low camera angle, lots of empty dark space at the top for a headline |
| 2 | How it works 01 Collect (`landing/steps.tsx`, grey card) | 4:5 | A compact brushed-aluminium data server with small glass drawers sliding out, each drawer holding tiny glowing price candles, on a neutral grey gradient background |
| 3 | How it works 02 Measure (blue card) | 4:5 | Twelve frosted glass bars of different heights standing on a deep blue lacquered plate, two bars tinted emerald green, cool blue light |
| 4 | How it works 03 Score (beige card) | 4:5 | A round analogue gauge dial in cream ceramic and brass with the needle near 79 out of 100, warm beige light, no readable text |
| 5 | How it works 04 Check (green card) | 4:5 | A glass rising line chart in 3D with two glowing green checkpoint spheres on it, on a deep green gradient |
| 6–9 | Fact tiles (`landing/facts.tsx`) | 1:1 small | Small isolated objects for the corner of each tile: a stack of glass tokens; a pulse wave in glass; a clock made of 1,440 tiny dots; twelve glass cubes in a grid |
| 10 | Transparency stage (`landing/transparency.tsx`) | 21:9 | Soft violet-indigo studio backdrop with floating frosted glass panels at different depths, room in the centre for a table |
| 11 | Track record panel (`landing/record-panel.tsx`) | 1:1 | A white ceramic donut ring, about one third of it navy blue, on white, soft shadow |

Process: generate #1 only, show the owner, generate the rest after the style is approved.
Done 2026-10-15: #1–#10 generated with FLUX.2 Max 2K (66 credits in total); #11 dropped (a drawn share would read as data).
Budget: about 55 generations, about 150 credits (Starter plan).

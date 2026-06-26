# Design

## Visual Direction

This is a product tool, not a marketing page. The interface should feel like a refined resume studio with AI coaching built into the workflow.

Primary reference: Magic Resume's clean editing surface, especially the three-column composition and A4 preview.

## Theme

Light product UI with neutral surfaces and one restrained blue accent. The physical scene is a user preparing job materials on a laptop in a quiet study or office, so the palette should stay bright, focused, and readable.

## Color Tokens

- Background: `oklch(0.96 0.008 255)`
- Surface: `oklch(1 0 0)`
- Surface muted: `oklch(0.985 0.004 255)`
- Border: `oklch(0.88 0.006 255)`
- Ink: `oklch(0.22 0.018 255)`
- Muted ink: `oklch(0.45 0.018 255)`
- Accent: `oklch(0.55 0.16 250)`
- Accent soft: `oklch(0.94 0.035 250)`
- Success: `oklch(0.58 0.14 155)`
- Warning: `oklch(0.68 0.14 75)`
- Danger: `oklch(0.58 0.18 25)`

## Typography

Use a system sans stack for the product shell. Keep Chinese and English text crisp with normal letter spacing. Headings should be compact and balanced; dense product text should use readable line height.

## Layout

The main app uses an app shell with:

- Top command bar for product name, active resume, AI status, and primary actions.
- Left navigation rail for major modules.
- Main work area for the selected workflow.
- Resume workbench page uses a three-column layout: modules, editor, preview.

Cards use small radii and light borders. Avoid nested cards where possible.

## Components

- Icon buttons for compact actions.
- Segmented controls for mode switching.
- Score rings, progress bars, and tagged findings for AI diagnosis.
- Chat-like question cards for interview practice.
- Tables only for admin or history records.

## Motion

Motion should be minimal: hover lift, focus rings, and short content transitions only. No decorative looping animation.

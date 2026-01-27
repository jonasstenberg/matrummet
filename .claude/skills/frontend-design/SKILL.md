---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use when user asks to build web components, pages, or applications. Generates creative, polished code that avoids generic AI aesthetics.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, WebFetch
context: fork
---

# Frontend Design

> Create distinctive, production-grade frontend interfaces that avoid generic AI aesthetics.

<when_to_use>

## When to Use

Invoke when user says:

- "redesign this component"
- "make this look better"
- "build a new page/component"
- "improve the UI"
- "create a landing page"
- "design a form/modal/card"
</when_to_use>

<design_thinking>

## Design Thinking

Before coding, understand the context and commit to a **bold aesthetic direction**:

1. **Purpose**: What problem does this interface solve? Who uses it?
2. **Tone**: Pick a clear aesthetic direction:
   - Brutally minimal
   - Maximalist chaos
   - Retro-futuristic
   - Organic/natural
   - Luxury/refined
   - Playful/toy-like
   - Editorial/magazine
   - Brutalist/raw
   - Art deco/geometric
   - Soft/pastel
   - Industrial/utilitarian
   - Scandinavian clean (fitting for a Swedish recipe app)

3. **Constraints**: Technical requirements (Next.js 16, React 19, Tailwind v4, Radix UI)
4. **Differentiation**: What makes this memorable?

Choose a clear conceptual direction and execute it with precision.
</design_thinking>

<tech_stack>

## Recept Tech Stack

| Technology   | Version | Usage                              |
| ------------ | ------- | ---------------------------------- |
| Next.js      | 16      | App Router, server components      |
| React        | 19      | UI components                      |
| Tailwind CSS | v4      | Styling (CSS-first config)         |
| Radix UI     | Latest  | Accessible component primitives    |
| Lucide React | Latest  | Icons                              |
| CVA          | Latest  | Component variant management       |
| tailwind-merge | Latest | Conditional class merging          |

Use existing dependencies. Avoid adding new UI libraries unless necessary.
</tech_stack>

<implementation>

## Implementation Requirements

Implement working code that is:

- Production-grade and functional
- Visually striking and memorable
- Cohesive with the existing Recept design language
- Accessible (Radix UI provides a11y primitives)
- Responsive
</implementation>

<aesthetics>

## Frontend Aesthetics Guidelines

### Typography

- Choose fonts that complement the existing design
- Use unexpected, characterful font choices when appropriate
- Pair a distinctive display font with a refined body font

### Color & Theme

- Commit to a cohesive aesthetic
- Use CSS variables for consistency
- Dominant colors with sharp accents outperform timid, evenly-distributed palettes

### Motion

- Use animations for effects and micro-interactions
- Prioritize CSS-only solutions
- Focus on high-impact moments: page transitions, hover states, loading states

### Spatial Composition

- Unexpected layouts where appropriate
- Generous negative space OR controlled density
- Grid-based but not rigid

### Backgrounds & Visual Details

- Create atmosphere and depth
- Contextual effects matching the overall aesthetic:
  - Gradient meshes
  - Noise textures
  - Geometric patterns
  - Layered transparencies
  - Subtle shadows
</aesthetics>

<anti_patterns>

## What NOT To Do

Avoid:

- Generic AI-generated aesthetics
- Overused font families (Inter, Roboto, Arial)
- Cliched color schemes (purple gradients on white)
- Predictable layouts and component patterns
- Cookie-cutter design lacking context-specific character

Instead:

- Interpret creatively and make unexpected choices
- Vary between light and dark themes, different fonts, different aesthetics
- Consider the Swedish/Scandinavian design heritage of the app
</anti_patterns>

<execution>

## Execution Principle

Match implementation complexity to the aesthetic vision:

- Maximalist designs need elaborate code with extensive animations and effects
- Minimalist or refined designs need restraint, precision, and careful attention to spacing, typography, and subtle details
- Elegance comes from executing the vision well
</execution>

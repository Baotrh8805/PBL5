# Design System Inspired by Instagram

## 1. Visual Theme & Atmosphere

Instagram's design system embodies a modern, social-first aesthetic centered on authentic connection and visual storytelling. The interface prioritizes clean typography, generous whitespace, and intuitive micro-interactions that feel natural and responsive. The palette blends cool blues with warm accent tones, creating a welcoming yet professional environment where user-generated content takes center stage. The design philosophy emphasizes accessibility, approachability, and a seamless mobile-to-desktop experience that encourages users to share moments with their communities.

**Key Characteristics**
- Modern, clean, and minimal aesthetic with strong focus on content
- Cool blue primary accent with warm green success states
- High contrast between text and backgrounds for readability
- Refined typography with balanced hierarchy
- Generous whitespace and breathing room around interactive elements
- Responsive design that adapts gracefully across all devices
- Emphasis on user-generated imagery and authentic moments

## 2. Color Palette & Roles

### Primary
- **Primary Blue** (`#4150F7`): Main brand color for buttons, links, and primary interactive elements; used for login CTAs and key affordances
- **Bright Blue** (`#0095F6`): Secondary primary accent for highlights and feature emphasis; used in notifications and active states
- **Sky Blue** (`#0064E0`): Tertiary blue for depth and hover states on primary elements

### Accent Colors
- **Success Green** (`#1CD164`): Positive action confirmations, success states, and validated inputs
- **Warning Yellow** (`#FACEB`): Warning and caution states requiring user attention

### Interactive
- **Interactive Text Blue** (`#4150F7`): Links, secondary buttons, and text-based interactions
- **Facebook Integration Blue** (`#0064E0`): Third-party integration buttons and social login affordances

### Neutral Scale
- **Almost Black** (`#1C1E21`): Primary text color for headings and body copy; highest contrast and readability
- **True Black** (`#000000`): Darkest neutral for critical text and high-emphasis elements
- **Very Dark Gray** (`#0C1014`): Secondary text and subtle UI elements
- **Very Dark Gray Alt** (`#0A1317`): Alternative dark gray for borders and dividers
- **Dark Gray** (`#111112`): Semantic text and muted interactions
- **Medium Gray** (`#2B3036`): Mid-tone for secondary UI elements
- **Gray Text** (`#737373`): Tertiary text, helper text, and placeholders
- **Light Gray** (`#3E4042`): Subtle borders and dividers
- **Very Light Gray** (`#E4E6EB`): Input borders and light UI backgrounds
- **Near White** (`#F0F2F5`): Page backgrounds and card surfaces
- **Off White** (`#F8F9F9`): Alternative light surface color

### Surface & Borders
- **White** (`#FFFFFF`): Primary surface, input backgrounds, and card containers
- **Light Surface** (`#F0F2F5`): Secondary surface and subtle backgrounds
- **Soft Gray Border** (`#E4E6EB`): Input field borders and light dividers
- **Dark Border** (`#3E4042`): Dark mode or emphasis borders

## 3. Typography Rules

### Font Family
**Primary**: `Optimistic, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`
**Secondary**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`
**Fallback Stack**: `system-ui, -apple-system, sans-serif`

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|------|--------|-------------|-----------------|-------|
| Display/Hero | Instagram Sans | 40px | 400 | 48px | 0px | Used for page titles and major headlines |
| Heading 1 | Optimistic | 32px | 600 | 38px | 0px | Primary section headings |
| Heading 2 | Optimistic | 24px | 600 | 28px | 0px | Secondary section headings |
| Heading 3 | Optimistic | 20px | 600 | 24px | 0px | Tertiary headings and card titles |
| Body Large | Optimistic | 16px | 400 | 20px | 0px | Primary body text for longer content |
| Body Regular | Optimistic | 15px | 400 | 17px | 0px | Standard body text and form labels |
| Body Medium | Optimistic | 15px | 500 | 19px | 0px | Medium-emphasis body text and input fields |
| Button | Optimistic | 15px | 600 | 18px | 0px | All button text |
| Link Primary | -apple-system | 14px | 400 | 18px | 0px | Primary links and navigation |
| Link Secondary | -apple-system | 12px | 400 | 18px | 0px | Tertiary links and footer links |
| Caption | -apple-system | 12px | 400 | 14px | 0px | Small supporting text and captions |
| Code | Menlo, monospace | 12px | 400 | 16px | 0px | Inline and block code |

### Principles
- Typography uses a dual-font system: **Optimistic** for primary UI and headings, **-apple-system** for body and links
- Font weights are limited to 400 (regular), 500 (medium), and 600 (semibold) for consistent hierarchy
- Line height increases with size to maintain comfortable reading rhythm
- All text should maintain minimum 4.5:1 contrast ratio for WCAG AA compliance
- Letter spacing remains 0px throughout for clean, modern appearance
- Inputs use 15px medium weight for comfortable data entry on all screen sizes

## 4. Component Stylings

### Buttons

#### Primary Button
- **Background**: `#4150F7`
- **Text Color**: `#FFFFFF`
- **Padding**: `12px 24px`
- **Border Radius**: `8px`
- **Border**: `none`
- **Font Size**: `15px`
- **Font Weight**: `600`
- **Line Height**: `18px`
- **Cursor**: `pointer`
- **Hover State**: Background `#3A41D6`, shadow `0px 2px 8px rgba(65, 80, 247, 0.24)`
- **Active State**: Background `#2F36B0`
- **Disabled State**: Background `#E4E6EB`, text color `#737373`, cursor `not-allowed`

#### Secondary Button
- **Background**: `#FFFFFF`
- **Text Color**: `#4150F7`
- **Padding**: `12px 24px`
- **Border Radius**: `8px`
- **Border**: `2px solid #4150F7`
- **Font Size**: `15px`
- **Font Weight**: `600`
- **Line Height**: `18px`
- **Hover State**: Background `#F0F2F5`, border color `#3A41D6`
- **Active State**: Background `#E4E6EB`

#### Ghost Button
- **Background**: `transparent`
- **Text Color**: `#4150F7`
- **Padding**: `12px 16px`
- **Border Radius**: `8px`
- **Border**: `1px solid #E4E6EB`
- **Font Size**: `15px`
- **Font Weight**: `600`
- **Line Height**: `18px`
- **Hover State**: Background `#F8F9F9`, border color `#D1D5DB`

#### Facebook Login Button
- **Background**: `#FFFFFF`
- **Text Color**: `#0064E0`
- **Padding**: `14px 20px`
- **Border Radius**: `8px`
- **Border**: `1px solid #E4E6EB`
- **Font Size**: `15px`
- **Font Weight**: `500`
- **Line Height**: `18px`
- **Icon**: Facebook logo in `#0064E0` at 18px

### Cards & Containers

#### Standard Card
- **Background**: `#FFFFFF`
- **Border**: `1px solid #E4E6EB`
- **Border Radius**: `8px`
- **Padding**: `20px`
- **Shadow**: `0px 1px 3px rgba(0, 0, 0, 0.06)`
- **Margin Bottom**: `16px`

#### Input Card
- **Background**: `#F8F9F9`
- **Border**: `1px solid #E4E6EB`
- **Border Radius**: `8px`
- **Padding**: `0px`
- **Hover State**: Border color `#D1D5DB`

### Inputs & Forms

#### Text Input (Default)
- **Background**: `#FFFFFF`
- **Text Color**: `#111112`
- **Font Size**: `15px`
- **Font Weight**: `500`
- **Font Family**: `Optimistic`
- **Padding**: `18px 12px 1px 12px`
- **Height**: `38px`
- **Border Radius**: `0px`
- **Border**: `none`
- **Border Bottom**: `1px solid #E4E6EB`
- **Line Height**: `19px`
- **Placeholder Color**: `#737373`
- **Placeholder Font Weight**: `400`
- **Focus State**: Border bottom color `#4150F7`, outline `none`, shadow `none`

#### Text Input (Focused)
- **Background**: `#FFFFFF`
- **Border Bottom**: `2px solid #4150F7`
- **Shadow**: `none`
- **Padding**: `18px 12px 0px 12px`

#### Text Input (Error)
- **Border Bottom**: `2px solid #E74C3C`
- **Helper Text Color**: `#E74C3C`

#### Label
- **Font Size**: `15px`
- **Font Weight**: `400`
- **Font Family**: `Optimistic`
- **Color**: `#111112`
- **Margin Bottom**: `8px`
- **Line Height**: `17px`

#### Form Container
- **Max Width**: `546px`
- **Margin**: `0px auto`
- **Padding**: `0px`

### Navigation

#### Primary Navigation Link
- **Background**: `transparent`
- **Text Color**: `#4150F7`
- **Font Size**: `14px`
- **Font Weight**: `400`
- **Font Family**: `-apple-system`
- **Padding**: `8px 0px`
- **Line Height**: `18px`
- **Cursor**: `pointer`
- **Hover State**: Text color `#3A41D6`, text decoration `underline`
- **Active State**: Font weight `500`

#### Footer Link
- **Background**: `transparent`
- **Text Color**: `#737373`
- **Font Size**: `12px`
- **Font Weight**: `400`
- **Font Family**: `-apple-system`
- **Padding**: `4px 8px`
- **Line Height**: `18px`
- **Hover State**: Text color `#111112`

## 5. Layout Principles

### Spacing System
**Base Unit**: `4px`

**Spacing Scale**:
- `4px` — Micro spacing for tight grouping
- `8px` — Extra small spacing for related elements
- `12px` — Small spacing for input padding and tight sections
- `16px` — Standard spacing for component padding and element margins
- `20px` — Medium spacing for card content and section spacing
- `24px` — Large spacing between major sections
- `32px` — Extra large spacing for major layout divisions
- `40px` — Large padding for hero sections
- `52px` — Extra large padding for full-width sections
- `120px` — Maximum spacing for vertical rhythm on desktop

**Usage Context**:
- **Buttons and inputs**: `12px` vertical, `16px` horizontal
- **Card padding**: `20px`
- **Section margins**: `24px` to `40px`
- **Form field spacing**: `16px` between fields
- **Text and interactive elements**: `8px` to `12px`

### Grid & Container
- **Max Width**: `1024px` for standard layouts
- **Form Max Width**: `546px` for authentication flows
- **Columns**: 12-column responsive grid
- **Gutter Width**: `16px` on desktop, `12px` on tablet, `8px` on mobile
- **Side Padding**: `40px` on desktop, `20px` on tablet, `16px` on mobile
- **Center Container**: `margin: 0 auto` with appropriate max-width

### Whitespace Philosophy
Instagram's design prioritizes breathing room around content and interactive elements. Whitespace creates visual hierarchy, guides focus, and improves readability. Every element receives adequate spacing to prevent cognitive overload. Generous margins separate logical sections, while tighter padding unifies related components. The design avoids cramped layouts, allowing users to comfortably interact with buttons, inputs, and navigation without accidental clicks.

### Border Radius Scale
- `0px` — Sharp corners for minimal visual softness (input underlines)
- `2px` — Subtle rounding for very minimal softness
- `4px` — Extra small rounded corners for minor UI elements
- `6px` — Small rounded corners for badges and small components
- `8px` — Standard rounded corners for buttons, inputs, and cards
- `12px` — Large rounded corners for featured containers
- `16px` — Extra large rounded corners for hero sections
- `24px` — Maximum rounding for full-bleed rounded shapes
- `50%` — Perfect circles for avatars and rounded icons

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat (0) | No shadow, solid colors only | Standard UI elements, body backgrounds, inputs |
| Raised (1) | `0px 1px 3px rgba(0, 0, 0, 0.06)` | Standard cards, mild emphasis |
| Floating (2) | `0px 2px 8px rgba(65, 80, 247, 0.24)` | Hover states on primary buttons, dropdown menus |
| Lifted (3) | `0px 4px 12px rgba(0, 0, 0, 0.12)` | Modal overlays, active popovers |
| Elevated (4) | `0px 8px 24px rgba(0, 0, 0, 0.16)` | Full-page modals, notification toasts |

**Shadow Philosophy**: Instagram uses minimal, subtle shadows primarily for interactive feedback and depth indication. Shadows are most prominent on primary actions (button hovers) and modals, with flat surfaces dominating the interface. Colors contain a slight blue tint (`#4150F7` base) to create cohesion with the brand palette. Shadows scale with interaction importance—the more critical the element, the more pronounced its elevation on hover or active states. Dark backgrounds receive reduced shadow intensity to maintain visibility and contrast.

## 7. Do's and Don'ts

### Do
- Use `#4150F7` for all primary CTAs and critical interactive elements
- Maintain consistent `15px` font size for all form inputs and body text
- Apply `8px` border radius to all buttons and standard input fields
- Keep form max-width at `546px` for comfortable reading and input on all screens
- Use the full blue hierarchy (`#4150F7` → `#3A41D6` → `#2F36B0`) for button states
- Implement hover states with background color shifts; never rely on shadow alone
- Use `#F8F9F9` as the page background and `#FFFFFF` for card surfaces
- Provide clear focus states for keyboard navigation with color and visual feedback
- Use `#737373` placeholder text color with reduced font weight (400)
- Apply `#1CD164` exclusively for success and positive confirmation states
- Include proper spacing (16px minimum) between form fields for comfortable interaction
- Use semantic HTML and ARIA labels for all interactive components

### Don't
- Don't use colors outside the defined palette for UI elements
- Don't apply shadows to non-interactive or flat UI components
- Don't mix font families within a single component (use Optimistic or -apple-system, not both)
- Don't use opacity-based color changes for interactive states; use explicit hex values
- Don't set border-radius values outside the defined scale
- Don't apply padding less than 12px to interactive elements
- Don't use line-height values other than those specified in the typography table
- Don't create buttons smaller than 38px in height (minimum touch target)
- Don't use gray text (`#737373`) for primary headings or critical information
- Don't mix left-aligned and center-aligned form layouts on the same page
- Don't apply font-weight heavier than 600 for body text
- Don't nest form inputs deeper than one container level

## 8. Responsive Behavior

### Breakpoints

| Breakpoint Name | Width | Key Changes |
|-----------------|-------|-------------|
| Mobile | 320px–479px | Single column, full-width forms, `16px` padding, `8px` spacing |
| Tablet | 480px–767px | Single to two-column, max `546px` form width centered, `20px` padding, `12px` spacing |
| Desktop | 768px–1024px | Full grid layout, `546px` form width centered, `40px` padding, `16px` spacing |
| Large Desktop | 1024px+ | Multi-column layouts, max-width containers, `52px` padding, `20px` spacing |

### Touch Targets
- **Minimum Height**: `44px` for all interactive elements (buttons, links, inputs)
- **Minimum Width**: `44px` for icon-only buttons
- **Padding Around Target**: Minimum `8px` between adjacent interactive elements to prevent accidental activation
- **Text Links**: `44px` clickable area achieved through padding, not text size alone
- **Checkbox/Radio**: `20px` × `20px` with `8px` padding around

### Collapsing Strategy
- **Forms**: Maintain full width on mobile (with `16px` padding), center on tablet/desktop with `546px` max-width
- **Navigation**: Stack vertically on mobile, horizontal on tablet and above
- **Cards**: Single-column stack on mobile, two-column on tablet, three-column on desktop
- **Spacing**: Reduce from `20px` to `12px` between sections on tablet, to `8px` on mobile
- **Font Sizes**: Maintain typographic hierarchy; scale display text from `40px` desktop to `28px` mobile
- **Buttons**: Full-width on mobile with centered text, auto-width on tablet/desktop
- **Inputs**: Full-width on mobile, `546px` max-width centered on tablet/desktop

## 9. Agent Prompt Guide

### Quick Color Reference
- **Primary CTA**: Primary Blue (`#4150F7`)
- **Secondary CTA**: Sky Blue (`#0064E0`)
- **Success State**: Success Green (`#1CD164`)
- **Warning State**: Warning Yellow (`#FACEB`)
- **Headings & Primary Text**: Almost Black (`#1C1E21`)
- **Body Text**: Dark Gray (`#111112`)
- **Secondary Text**: Gray Text (`#737373`)
- **Input Background**: White (`#FFFFFF`)
- **Page Background**: Near White (`#F0F2F5`)
- **Card Background**: Off White (`#F8F9F9`)
- **Borders**: Soft Gray Border (`#E4E6EB`)
- **Hover/Focus**: Bright Blue (`#0095F6`)

### Iteration Guide
1. **Color Consistency**: All primary buttons must use `#4150F7` with `#3A41D6` on hover and `#2F36B10` on active. Never deviate from this three-value hierarchy.
2. **Typography Stack**: Use `Optimistic, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` for all UI text. Fallback to `-apple-system` only for navigation links and captions.
3. **Spacing Foundation**: Base all spacing on the `4px` unit. Form fields require `16px` horizontal padding, `18px` top, `1px` bottom. Cards require `20px` padding on all sides.
4. **Border Radius Consistency**: Apply `8px` radius to all buttons, inputs, and cards. Do not mix radius values within a single component set—maintain visual cohesion.
5. **Form Layout**: Restrict form width to `546px` maximum, center with `margin: 0 auto`. Stack all inputs vertically with `16px` margin-bottom between fields. Remove default input styling and apply border-bottom only.
6. **Elevation Subtlety**: Use shadows sparingly. Apply only on hover states (`0px 2px 8px rgba(65, 80, 247, 0.24)`) and modals. Flat surfaces (no shadow) are the default state.
7. **Interactive Feedback**: Every interactive element must have distinct hover, active, and disabled states using explicit color values, not opacity. Disabled state uses `#E4E6EB` background with `#737373` text.
8. **Responsive Scaling**: Maintain form width at `546px` across all breakpoints; center with padding. Font sizes remain constant; only spacing and layout columns adjust per breakpoint.
9. **Accessibility Priority**: Ensure 4.5:1 minimum contrast on all text. Implement clear focus states with color shifts. Use proper semantic HTML (labels, button types, input types). Avoid relying on color alone to convey state.
10. **Minimalist Philosophy**: Embrace negative space and flat design. Every element should serve a purpose. Remove unnecessary shadows, gradients, and decorative styling. Let content and clear hierarchy drive visual interest.
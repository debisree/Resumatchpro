# ResuMatch Pro Design Guidelines

## Design Approach

**Selected Approach:** Design System + Productivity References

Drawing inspiration from Linear, Notion, and Grammarly to create a clean, professional productivity tool focused on clarity and efficient data presentation. The design emphasizes readability, clear hierarchy, and smooth workflows for resume analysis.

**Core Principles:**
- Clarity over decoration
- Information hierarchy through typography and spacing
- Progressive disclosure of complexity
- Professional, trustworthy aesthetic

---

## Typography

**Font Stack:** Inter (primary), system-ui (fallback)
- Include via Google Fonts CDN: `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap`

**Hierarchy:**
- Page Headlines: `text-3xl font-bold` (landing), `text-2xl font-semibold` (dashboard/results)
- Section Titles: `text-xl font-semibold`
- Card Headers: `text-lg font-medium`
- Body Text: `text-base font-normal`
- Labels/Meta: `text-sm font-medium`
- Helper Text: `text-sm` (regular weight)
- Numerical Data (scores): `text-4xl font-bold` (primary), `text-xl font-semibold` (secondary)

---

## Layout System

**Spacing Primitives:** Consistent use of Tailwind units: 2, 4, 6, 8, 12, 16, 24
- Tight spacing: `gap-2`, `p-2`
- Standard spacing: `gap-4`, `p-4`, `mb-4`
- Section spacing: `gap-8`, `py-8`, `mb-12`
- Page-level: `p-6` (mobile), `p-12` (desktop)

**Container Strategy:**
- Max width: `max-w-6xl mx-auto` for main content
- Forms/Cards: `max-w-md mx-auto` for focused tasks
- Results dashboard: `max-w-7xl mx-auto` for data display

**Grid Systems:**
- Dashboard cards: `grid grid-cols-1 lg:grid-cols-2 gap-6`
- Section scores: `grid grid-cols-2 md:grid-cols-4 gap-4`
- Analysis metrics: `flex flex-wrap gap-6`

---

## Component Library

### Navigation
**Top Nav Bar:**
- Fixed height: `h-16`
- Layout: Flex row with logo left, user menu right
- Padding: `px-6 lg:px-12`
- Border: `border-b` for subtle separation
- User avatar: `w-8 h-8 rounded-full` with username

### Cards & Containers
**Standard Card:**
- Border: `border rounded-lg`
- Padding: `p-6`
- Shadow: `shadow-sm hover:shadow-md` (subtle elevation)

**Upload Card (Dashboard):**
- Prominent dashed border: `border-2 border-dashed rounded-xl`
- Padding: `p-12` for generous drop zone
- Icon size: `w-16 h-16` (document/upload icon from Heroicons)

**Results Card:**
- Clean borders: `border rounded-lg`
- Header with title + metadata: `p-4 border-b`
- Content area: `p-6`

### Forms & Inputs
**Text Input:**
- Height: `h-12`
- Padding: `px-4`
- Border: `border rounded-lg`
- Focus state: `focus:ring-2 focus:ring-offset-2`

**File Upload:**
- Input hidden, replaced with styled drop zone
- Visual feedback states: default, hover, dragover, uploading
- File preview with name + size display

**Buttons:**
- Primary: `h-12 px-6 rounded-lg font-medium`
- Secondary: Same height, outlined style
- Icon buttons: `w-10 h-10 rounded-lg` for actions
- Disabled state: reduced opacity with `cursor-not-allowed`

### Data Visualization

**Completeness Score Dial:**
- Center element: Large circular progress indicator
- Size: `w-48 h-48` (mobile: `w-32 h-32`)
- Score display: `text-5xl font-bold` centered inside
- Label below: `text-sm`
- Use SVG circle with stroke-dasharray for progress

**Section Quality Table:**
- Clean rows: `border-b last:border-b-0`
- Cell padding: `px-4 py-3`
- Score badges: `inline-flex items-center px-3 py-1 rounded-full text-sm font-medium`
- Score labels mapping:
  - 0: "Missing"
  - 1-2: "Weak"
  - 3: "Fair"
  - 4: "Strong"
  - 5: "Perfect"

**Suggestions List:**
- Bullets: Custom styled with checkmark or lightbulb icons
- Item spacing: `space-y-3`
- Each item: `flex gap-3` with icon + text
- Text: `text-base leading-relaxed`

### States & Feedback

**Loading States:**
- Spinner: Heroicons `ArrowPathIcon` with `animate-spin`
- Skeleton screens for data loading: `animate-pulse` on placeholder divs
- Upload progress: Linear progress bar `h-1 rounded-full` with animated width

**Empty States:**
- Icon: `w-20 h-20` (relevant Heroicon)
- Message: `text-lg font-medium` with `text-base` description below
- CTA button positioned below text

**Error States:**
- Alert box: `border-l-4 p-4 rounded-r`
- Icon + message layout
- Dismiss button in top-right corner

---

## Page-Specific Layouts

### Landing/Login Page
- Centered card: `max-w-md mx-auto mt-24`
- Logo/title at top
- Single input field + button
- Disclaimer text below: `text-xs` with reduced opacity

### Dashboard
- Grid layout: Resume cards in 2-column grid on desktop
- Empty state when no resumes uploaded
- Upload card prominently displayed
- Recent analyses list below

### Results Page
- Hero section: Score dial + headline
- Three-column grid below: Section scores (left 2 cols), suggestions (right col)
- Sticky header with back button
- Download/share actions in top-right

---

## Icon Library

**Selected:** Heroicons (outline style for most, solid for emphasis)
- CDN: Include via `@heroicons/vue` or inline SVGs
- Common icons needed:
  - DocumentIcon (resume)
  - ArrowUpTrayIcon (upload)
  - CheckCircleIcon (success)
  - ExclamationTriangleIcon (warning)
  - UserCircleIcon (profile)
  - ChartBarIcon (analytics)
  - LightBulbIcon (suggestions)

---

## Responsive Breakpoints

- Mobile-first approach
- Key breakpoints: `md:` (768px), `lg:` (1024px)
- Dashboard: Stack vertically on mobile, 2-col grid on lg
- Results: Single column on mobile, multi-column on desktop
- Navigation: Compact on mobile, full on desktop

---

## Accessibility

- All interactive elements: `focus-visible:ring-2 focus-visible:ring-offset-2`
- Proper heading hierarchy (h1 → h2 → h3)
- Form labels with `for` attributes
- ARIA labels for icon-only buttons
- Sufficient contrast ratios for text
- Keyboard navigation support throughout
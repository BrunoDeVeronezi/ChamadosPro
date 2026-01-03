# Design Guidelines: ChamadosPro Service Management System

## Design Approach: Modern SaaS Productivity Platform

**Selected Reference Pattern:** Linear + Notion hybrid approach
- Linear's clean data presentation and sophisticated interactions for dashboards and tables
- Notion's approachable forms and content organization for client/ticket management
- Asana's clear status indicators and workflow visualization

**Design Principles:**
1. **Clarity Over Decoration** - Every element serves a functional purpose
2. **Information Hierarchy** - Critical data immediately visible, progressive disclosure for details
3. **Professional Efficiency** - Minimize clicks, maximize data density without overwhelming
4. **Trustworthy Interface** - Clean, consistent patterns that inspire confidence in financial data

---

## Typography System

**Font Stack:** Inter (primary), SF Mono (monospace for codes/IDs)

**Hierarchy:**
- **Page Titles:** text-3xl font-semibold (Dashboard titles, main screens)
- **Section Headers:** text-xl font-semibold (Card headers, panel titles)
- **Subsection Headers:** text-base font-semibold (Form sections, table headers)
- **Body Text:** text-sm font-normal (Primary content, descriptions)
- **Labels/Captions:** text-xs font-medium uppercase tracking-wide (Input labels, metadata)
- **Data Display:** text-sm font-medium (Table cells, metric values)
- **Large Metrics:** text-4xl font-bold (Dashboard KPIs)

---

## Layout & Spacing System

**Spacing Primitives:** Tailwind units of 1, 2, 4, 6, 8, 12, 16 (p-1, m-4, gap-6, etc.)

**Container Strategy:**
- **App Shell:** Fixed sidebar (w-64), top navigation (h-16), main content (flex-1)
- **Content Max-Width:** max-w-7xl mx-auto for main content areas
- **Section Padding:** px-6 py-8 for main sections, px-4 py-6 for cards
- **Form Width:** max-w-2xl for single-column forms, max-w-4xl for two-column

**Grid Patterns:**
- **Dashboard Cards:** grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6
- **Metric Tiles:** grid grid-cols-2 lg:grid-cols-4 gap-4
- **Form Fields:** grid grid-cols-1 md:grid-cols-2 gap-6
- **Table Layouts:** w-full with responsive horizontal scroll

---

## Component Library

### Navigation & Shell

**Top Navigation Bar:**
- Fixed height (h-16), border-b, shadow-sm
- Left: Logo + breadcrumbs (text-sm with chevron separators)
- Right: Integration status indicators (dot + tooltip), notification bell, user avatar dropdown
- Integration Status Badge: Inline with icon + text ("Google Calendar: Connected" with green dot, "Not Linked" with amber dot)

**Sidebar Navigation:**
- Fixed left (w-64), full height, subtle border-right
- Logo at top (py-6 px-4)
- Navigation groups with uppercase labels (text-xs font-semibold tracking-wide px-4 py-2)
- Menu items: px-4 py-2, rounded-md within sidebar padding, icon + text (gap-3)
- Active state: distinct background, medium font-weight
- Collapse to icons only on mobile

### Dashboard Components

**Metric Cards:**
- Rectangular cards (rounded-lg, border, shadow-sm)
- Internal padding: p-6
- Structure: Label (text-xs uppercase), Value (text-3xl font-bold), Change indicator (text-sm with ↑/↓ icon)
- Secondary metrics: text-sm in muted text below main value

**Status Banners:**
- Full-width, positioned below top nav, dismissible
- Warning (Google not linked): amber background, dark text, action button on right
- Error (quota exceeded): red background, white text, help link
- Success: green background
- Height: py-3 px-6, flex with justify-between

**Data Tables:**
- Zebra striping on rows (subtle background alternation)
- Header row: border-b-2, font-semibold, text-xs uppercase tracking-wide
- Cell padding: px-6 py-4
- Status pills: inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
- Action column: icons on right with gap-2
- Hover state: subtle row highlight
- Empty state: centered icon + text (py-12)

### Forms & Input Patterns

**Form Structure:**
- Section groups with dividing borders (border-t pt-8 mt-8)
- Form sections: space-y-6
- Label: block text-sm font-medium mb-2
- Input: w-full px-4 py-2.5 rounded-lg border
- Helper text: text-xs mt-1
- Error state: red border, red helper text with icon
- Required indicator: red asterisk after label

**Client Type Toggle (PF/PJ):**
- Segmented control at form top
- Two buttons side-by-side, equal width, one selected state
- Height: h-10, toggle entire form sections based on selection

**Date/Time Pickers:**
- Calendar popover with grid layout for dates
- Time slots shown as grid of buttons (4 columns)
- Selected slot: distinct background, checkmark icon
- Disabled slots: reduced opacity, not clickable

**Multi-Select Dropdowns:**
- Button showing selected count + chevron
- Popover with checkboxes (space-y-2, p-4)
- Search input at top for long lists
- Selected items shown as removable pills below field

### Scheduling Interface

**Calendar View:**
- Week grid layout with time slots (rows) and days (columns)
- Time labels on left (text-xs)
- Appointment blocks: rounded corners, truncated text, shows client name + service
- Grid lines: subtle borders
- Current time indicator: horizontal line with dot
- Controls: Previous/Next week, Today button, View toggle (Week/Day)

**Public Booking Page:**
- Hero section: Large heading (text-5xl font-bold), subheading (text-xl), background with blur overlay
- Service Cards: grid layout (md:grid-cols-2 lg:grid-cols-3 gap-6)
- Each card: Service name, duration badge, price (text-2xl font-bold), description, "Book Now" button
- Time slot selection: Calendar + time grid in two-column layout (md:grid-cols-2)
- Confirmation step: Summary card with all details, form for contact info

### Financial Components

**Cash Flow Chart:**
- Area chart showing income over time
- X-axis: dates, Y-axis: currency values
- Tooltip on hover with exact values
- Toggle: View by Technician/Company

**Receivables List:**
- Cards with client name, amount (large, bold), due date, status pill
- Group by status (Pending, Overdue, Paid)
- Expandable to show ticket details
- Filter dropdowns at top (Technician, Client, Date Range)

**Aging Report Table:**
- Columns: Client, Current, 1-30 days, 31-60 days, 61-90 days, 90+ days
- Subtotals row with font-semibold
- Export button (top-right): icon + "Export CSV"

### Dialogs & Overlays

**Modal Structure:**
- Centered overlay (max-w-2xl)
- Header: border-b, pb-4, flex with title (text-lg font-semibold) and close button
- Body: p-6, space-y-6
- Footer: border-t, pt-4, flex justify-end gap-3
- Backdrop: semi-transparent overlay

**Confirmation Dialogs:**
- Icon (large, centered) + heading + description
- Two-button layout (Cancel + Confirm action)

**Toast Notifications:**
- Fixed bottom-right, stack vertically (gap-2)
- Width: w-96, rounded-lg, shadow-lg, p-4
- Icon + message + close button
- Auto-dismiss after 5 seconds

---

## Images

**Hero Section (Public Booking Page):**
- Full-width hero image showing professional service environment (technician working, clean office space, or abstract tech background)
- Height: h-96 on desktop, h-64 on mobile
- Semi-transparent overlay (backdrop-blur) to ensure text readability
- CTA buttons: Blurred background (backdrop-blur-sm), white text, no hover effects (component handles states)

**Empty States:**
- Centered illustrations (w-48 h-48) for "No tickets yet", "No clients", "Calendar empty"
- Simple line art or abstract geometric shapes

**Client/User Avatars:**
- Circular (rounded-full), sizes: w-8 h-8 (small), w-10 h-10 (medium), w-16 h-16 (large)
- Fallback: Initials on solid background if no image

---

## Animations

Use sparingly and purposefully:
- **Micro-interactions:** Checkbox check, button press (scale-95 active state)
- **Page transitions:** Fade-in on route change (duration-200)
- **Loading states:** Skeleton screens for tables/cards, spinning icon for buttons
- **Avoid:** Scroll-triggered animations, complex page transitions, hover grow effects
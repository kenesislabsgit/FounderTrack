# Requirements Document

## Introduction

FounderTrack is a React + Firebase workspace management tool for tracking attendance, daily reports, leave, and team analytics. The application currently has several issues preventing production deployment: an exposed API key, base64 photos in Firestore documents, hardcoded statistics, missing hosting configuration, and various UI/UX gaps. This requirements document covers the changes needed to make FounderTrack production-ready on Vercel with Firebase backend services.

## Glossary

- **App**: The FounderTrack React single-page application
- **Vercel_Function**: A serverless function deployed in the `api/` directory of the Vercel project, executing server-side logic
- **Firebase_Storage**: Firebase Cloud Storage service used for binary file uploads (photos)
- **Firestore**: Firebase Cloud Firestore NoSQL document database
- **Gemini_API**: Google Gemini generative AI API used for performance analysis and the analytics bot
- **AI_Proxy**: A Vercel_Function that accepts client requests and forwards them to the Gemini_API with the API key stored server-side
- **Attendance_Page**: The tab view displaying attendance log records and statistics
- **Analytics_Page**: The admin tab view displaying team performance charts and AI-generated insights
- **Leave_Page**: The tab view displaying leave balances and leave/WFH requests
- **Dashboard_Page**: The employee tab view showing current shift status and daily report entry
- **Header**: The top bar of the App containing the page title, search bar, and notification bell
- **Router**: A client-side URL routing mechanism mapping URL paths to tab views
- **Admin**: A user with role `admin` who has full access to all management features
- **Photo_Upload_Service**: The module responsible for uploading check-in photos and returning a download URL
- **Glass_Surface**: A UI surface style using backdrop-blur, layered shadows, and noise texture to create a frosted glass appearance
- **Skeuomorphic_Glass**: The visual design system combining glass surfaces, 3D buttons, and ambient glows for a premium tactile feel
- **Variant_System**: A semantic naming convention for component styles (primary/secondary/tertiary) following HeroUI v3 principles
- **HeroUI**: The HeroUI v3 React component library built on React Aria Components, providing accessible compound components with semantic variants and Tailwind v4 support
- **StatusDot**: A small colored circle component that visually indicates a user's current session state (active, on-break, away, offline) with optional pulse animation
- **Session_State**: The current activity status of a user: active (working), on-break, away, or offline

## Requirements

### Requirement 1: Move Gemini API Key to Server-Side

**User Story:** As a developer, I want the Gemini API key stored only on the server, so that it is not exposed in the client-side JavaScript bundle.

#### Acceptance Criteria

1. THE Vercel_Function SHALL store the Gemini API key exclusively in server-side environment variables
2. THE App SHALL send AI requests to the AI_Proxy instead of calling the Gemini_API directly
3. WHEN the AI_Proxy receives a request, THE AI_Proxy SHALL validate that the request originates from an authenticated user by verifying the Firebase ID token
4. WHEN the AI_Proxy receives a valid request, THE AI_Proxy SHALL forward the request to the Gemini_API and return the response to the App
5. IF the AI_Proxy receives a request with an invalid or missing token, THEN THE AI_Proxy SHALL return an HTTP 401 response
6. THE vite.config.ts SHALL remove the `define` entry that injects `process.env.GEMINI_API_KEY` into the client bundle

### Requirement 2: Move Check-In Photos to Firebase Storage

**User Story:** As a developer, I want check-in photos stored in Firebase Storage instead of as base64 strings in Firestore documents, so that Firestore documents stay well under the 1 MB size limit.

#### Acceptance Criteria

1. WHEN a user uploads a check-in photo, THE Photo_Upload_Service SHALL upload the compressed image to Firebase_Storage under the path `check-in-photos/{uid}/{date}/{filename}`
2. WHEN the upload completes, THE Photo_Upload_Service SHALL store the Firebase_Storage download URL in the Firestore attendance document instead of the base64 string
3. THE App SHALL render check-in photos using the Firebase_Storage download URL
4. THE Firebase_Storage security rules SHALL allow authenticated users to upload files only to their own `check-in-photos/{uid}/` path
5. THE Firebase_Storage security rules SHALL allow authenticated admins to read all files under `check-in-photos/`
6. THE Firebase_Storage security rules SHALL restrict individual file uploads to a maximum of 5 MB

### Requirement 3: Compute Attendance Statistics from Real Data

**User Story:** As an admin, I want attendance statistics computed from actual attendance records, so that the displayed metrics reflect real team performance.

#### Acceptance Criteria

1. WHEN the Attendance_Page loads, THE App SHALL compute the average shift duration from all attendance records that have both a checkInTime and a checkOutTime
2. WHEN the Attendance_Page loads, THE App SHALL compute the on-time arrival percentage by comparing each checkInTime against a configurable expected start time
3. THE App SHALL replace the hardcoded "Avg. Shift Duration: 8.4 hrs" text with the computed average shift duration
4. THE App SHALL replace the hardcoded "On-Time Arrival: 92%" text with the computed on-time arrival percentage

### Requirement 4: Compute Analytics Metrics from Real Data

**User Story:** As an admin, I want analytics metrics computed from actual report and attendance data, so that the dashboard shows accurate performance information.

#### Acceptance Criteria

1. WHEN the Analytics_Page loads, THE App SHALL compute the average task completion rate from all daily report todoList entries
2. THE App SHALL replace the hardcoded "Avg. Efficiency: 94%" text with the computed average task completion rate

### Requirement 5: Compute Leave Balances from Real Data

**User Story:** As an employee, I want my leave balance computed from approved leave records, so that I see an accurate count of remaining leave days.

#### Acceptance Criteria

1. THE App SHALL define configurable annual leave and WFH allowances (default: 18 leave days, 8 WFH days per year)
2. WHEN the Leave_Page loads, THE App SHALL compute used leave days by counting approved leave requests for the current calendar year
3. WHEN the Leave_Page loads, THE App SHALL compute used WFH days by counting approved WFH requests for the current calendar year
4. THE App SHALL replace the hardcoded "12 / 18 days" and "4 / 8 days" text with the computed remaining and total allowances

### Requirement 6: Compute Shift Progress from Real Data

**User Story:** As an employee, I want the shift progress bar to reflect my actual elapsed shift time, so that I can see how far along my current shift is.

#### Acceptance Criteria

1. WHILE a user has an active shift (checked in, not checked out), THE Dashboard_Page SHALL compute the shift progress percentage as elapsed time divided by expected shift duration (default: 8 hours)
2. THE App SHALL replace the hardcoded 45% progress value with the computed shift progress percentage
3. WHEN the computed progress exceeds 100%, THE Dashboard_Page SHALL cap the displayed progress at 100%

### Requirement 7: Remove or Implement the Search Bar

**User Story:** As a user, I want the search bar in the header to either function or be removed, so that the UI does not contain non-functional elements.

#### Acceptance Criteria

1. THE Header SHALL remove the decorative search bar that performs no action

### Requirement 8: Fix First-User-Becomes-Admin Race Condition

**User Story:** As a developer, I want the first-user admin assignment to be atomic, so that concurrent signups cannot produce multiple admin accounts.

#### Acceptance Criteria

1. WHEN a new user signs up and no admin user exists, THE App SHALL assign the admin role using a Firestore transaction that checks for existing admin users and creates the admin profile atomically
2. IF a concurrent signup attempts to claim the admin role after another user has already been assigned, THEN THE App SHALL assign the concurrent user a non-admin role

### Requirement 9: Add Client-Side Routing

**User Story:** As a user, I want URL-based navigation with deep linking and browser back/forward support, so that I can bookmark pages and use standard browser navigation.

#### Acceptance Criteria

1. THE Router SHALL map each tab view to a unique URL path (e.g., `/dashboard`, `/attendance`, `/leaves`, `/reports`, `/analytics`, `/settings`)
2. WHEN a user navigates to a URL path directly, THE Router SHALL render the corresponding tab view
3. WHEN a user clicks a sidebar navigation item, THE Router SHALL update the browser URL without a full page reload
4. WHEN a user presses the browser back button, THE Router SHALL navigate to the previous tab view
5. WHEN an unauthenticated user navigates to a protected URL, THE Router SHALL redirect to the login view

### Requirement 10: Add Vercel Hosting Configuration

**User Story:** As a developer, I want proper Vercel hosting configuration, so that the app deploys correctly with SPA routing and serverless functions.

#### Acceptance Criteria

1. THE App SHALL include a `vercel.json` configuration file at the project root
2. THE vercel.json SHALL configure SPA fallback routing so that all non-API, non-asset requests serve `index.html`
3. THE vercel.json SHALL route `/api/*` requests to the Vercel_Function handlers in the `api/` directory

### Requirement 11: Fix HTML Metadata

**User Story:** As a user, I want the browser tab to show the correct app name and icon, so that the app appears professional and identifiable.

#### Acceptance Criteria

1. THE index.html SHALL set the page title to "FounderTrack"
2. THE index.html SHALL include a favicon link element pointing to a valid favicon file
3. THE index.html SHALL include Open Graph meta tags for title, description, and type

### Requirement 12: Optimize AI Bot Context Size

**User Story:** As a developer, I want the AI bot to send only relevant data in each message, so that API costs are reduced and response quality improves.

#### Acceptance Criteria

1. WHEN a user sends a message to the AI bot, THE App SHALL send a summarized dataset to the AI_Proxy instead of the entire raw dataset
2. THE App SHALL compute summary statistics (total users, total attendance records, average hours, task completion rates) client-side and send only the summary plus the user message to the AI_Proxy
3. WHEN the dataset exceeds 50 records for any collection, THE App SHALL truncate to the most recent 50 records before summarizing

### Requirement 13: Fix Team Management Header Title

**User Story:** As an admin, I want the header to display the correct title when viewing the Team Management tab, so that the UI is consistent.

#### Acceptance Criteria

1. WHEN the active tab is "team-management", THE Header SHALL display "Team Management" as the page title

### Requirement 14: Enforce Role Selection Server-Side

**User Story:** As a developer, I want role selection enforced by Firestore security rules, so that users cannot assign themselves privileged roles.

#### Acceptance Criteria

1. THE Firestore security rules SHALL prevent non-admin users from creating a user document with the role "admin" or "founder"
2. THE Firestore security rules SHALL prevent non-admin users from updating their own role field to "admin" or "founder"
3. WHEN a new user selects a role during signup, THE App SHALL only offer "employee" and "intern" as selectable options (removing "founder" from the client-side selection)

### Requirement 15: Add Pagination to List Views

**User Story:** As a user, I want list views to load data in pages, so that the app remains responsive with large datasets.

#### Acceptance Criteria

1. WHEN the Attendance_Page loads, THE App SHALL display attendance records in pages of 20 records
2. WHEN the user reaches the end of the current page, THE App SHALL provide a control to load the next page of records
3. THE Firestore queries for attendance, daily reports, and leave requests SHALL use cursor-based pagination with `startAfter` and `limit`

### Requirement 16: Refactor App.tsx Monolith

**User Story:** As a developer, I want App.tsx broken into smaller, focused component files, so that the codebase is maintainable and navigable.

#### Acceptance Criteria

1. THE App SHALL extract each tab view (Dashboard, Attendance, Leaves, Reports, Analytics, Bot, Team Management, Brainstorm, Settings) into its own component file under `src/components/`
2. THE App SHALL extract shared UI components (StatCard, AttendanceRow, RoleSelection) into reusable component files under `src/components/`
3. THE App.tsx file SHALL contain only top-level routing, authentication state, and layout composition

### Requirement 17: Implement Skeuomorphic Glass Visual Identity System with HeroUI v3

**User Story:** As a user, I want the application to have a premium, tactile visual identity using HeroUI v3 compound components styled with frosted glass surfaces, 3D buttons, and ambient glows, so that the interface feels polished and distinct from flat/Material design while maintaining full accessibility.

#### Acceptance Criteria

##### Component Library Foundation

1. THE App SHALL use `@heroui/react` as the sole component library for all interactive UI elements (Button, Card, Modal, Input, Tabs, Avatar, Badge, Tooltip, Dropdown, Skeleton, and others)
2. THE App SHALL use `@heroui/styles` for variant functions (`tv()`, `buttonVariants`, `cardVariants`, etc.) and BEM class customization
3. THE App SHALL use HeroUI compound component patterns (e.g., `<Card><CardHeader /><CardBody /><CardFooter /></Card>`) instead of custom HTML elements with Tailwind utility classes
4. THE App SHALL retain the `motion` (framer-motion) dependency for complex component transitions (AnimatePresence, layout animations, page transitions) alongside HeroUI v3 CSS animations for simpler effects
5. THE App SHALL retain `lucide-react` for iconography, as HeroUI does not mandate a specific icon library
6. THE App SHALL retain `recharts` for chart visualizations, as HeroUI does not provide chart components

##### Color System

7. THE App SHALL define all theme colors as CSS custom variables on `:root` and `[data-theme="dark"]` selectors, compatible with HeroUI's theming layer
8. THE App SHALL use dark goldenrod (`hsl(40 95% 52%)` dark mode, `hsl(36 95% 46%)` light mode) as the primary accent color mapped to HeroUI's `--accent` CSS variable
9. WHILE dark mode is active, THE App SHALL use a deep blue-gray background (`hsl(225 15% 7%)`) instead of pure black
10. WHILE light mode is active, THE App SHALL use a warm cream background (`hsl(42 25% 97%)`) instead of pure white
11. THE App SHALL use gold for active session states, orange-amber for break session states, and muted gray for ended or away session states
12. THE App SHALL use standard red for destructive action indicators, mapped to HeroUI's `danger` semantic variant

##### Glass Surfaces via HeroUI CSS Customization

13. THE App SHALL define a `.glass` BEM class in a `@layer components` block applying `backdrop-filter: blur(22px)`, subtle inset highlights, layered box-shadows, and an SVG fractal noise texture overlay at 2.5% opacity for use on HeroUI Card and sidebar components
14. THE App SHALL define a `.glass-elevated` BEM class in a `@layer components` block applying `backdrop-filter: blur(28px)`, heavier shadows, and a more prominent inset highlight than `.glass` for use on HeroUI Modal, Dropdown, and Popover components
15. THE App SHALL define an `.inset-well` BEM class in a `@layer components` block applying inward shadows for use on HeroUI Input and progress track components to create a pressed-in appearance

##### 3D Buttons via HeroUI Tailwind Variants

16. THE App SHALL define a `skeuButtonVariants` function using `tv()` from `@heroui/styles` that extends `buttonVariants` with a `primary` variant applying a gradient from lighter to darker gold, an inset top-edge highlight, and a bottom-edge shadow
17. WHEN a user hovers over a HeroUI Button using the `primary` skeuomorphic variant, THE App SHALL lift the element by 0.5px and apply an ambient glow effect using CSS transitions (150ms)
18. WHEN a user presses a HeroUI Button using the `primary` skeuomorphic variant, THE App SHALL sink the element by 0.5px and apply an inset shadow using CSS transitions (150ms)
19. THE `skeuButtonVariants` function SHALL provide a `ghost` variant applying a subtle gradient, minimal shadow, and the same lift/press micro-interactions as the `primary` variant

##### Semantic Variant System

20. THE App SHALL define a Variant_System in a `variants.ts` file using `tv()` from `@heroui/styles` to extend HeroUI's base variant functions
21. THE Variant_System SHALL provide button variants: primary, secondary, tertiary, danger, and ghost, extending HeroUI's `buttonVariants`
22. THE Variant_System SHALL provide card variants: glass, elevated, inset, and flat, extending HeroUI's `cardVariants`
23. THE Variant_System SHALL provide badge variants: default (gold), success (emerald), warning (amber), danger (red), and muted, extending HeroUI's badge styles
24. THE Variant_System SHALL provide consistent size options (sm, md, lg) across all component variant functions, aligning with HeroUI's built-in size scale

##### Mobile Responsiveness

25. WHEN the viewport width is below 768px, THE Sidebar SHALL collapse into a toggleable overlay or hamburger menu using HeroUI Drawer or equivalent compound component
26. THE App SHALL apply responsive layout adjustments so that all page content remains usable on viewports as narrow as 320px

##### Toast Notifications

27. WHEN the App needs to display a transient user message, THE App SHALL render a toast notification using a HeroUI-based component instead of calling the browser `alert()` function
28. THE toast notification component SHALL support info, success, warning, and error visual variants using HeroUI's semantic color system
29. THE toast notification component SHALL auto-dismiss after a configurable duration (default: 4 seconds)

##### Loading States

30. WHILE data is being fetched for a page view, THE App SHALL display HeroUI Skeleton components matching the layout of the expected content
31. THE HeroUI Skeleton components SHALL use a subtle shimmer animation to indicate loading progress

##### Dark/Light Mode Toggle

32. THE Settings page SHALL provide a functional dark/light mode toggle replacing the current "Coming Soon" placeholder, using a HeroUI Switch or Button component
33. WHEN a user toggles the theme, THE App SHALL persist the selected theme preference in localStorage, update the `data-theme` attribute on the document root, and apply the corresponding CSS custom variable set immediately, leveraging HeroUI's built-in dark mode support
34. WHEN a user loads the App without a stored theme preference, THE App SHALL default to the operating system preferred color scheme

##### Accessibility

35. THE App SHALL rely on HeroUI's React Aria foundation to provide WCAG 2.1 AA compliance including automatic ARIA attributes, keyboard navigation, focus management, and screen reader support for all interactive components

##### Sidebar Design

36. THE Sidebar SHALL have a fixed width of 220px with a solid background (not glass) to serve as the visual anchor of the layout
37. THE Sidebar SHALL display a golden gradient logo mark ("K" for Kenesis) with an inset highlight effect at the top
38. WHEN a nav item is active, THE Sidebar SHALL apply a golden gradient background to the active item using the same 3D treatment as primary buttons
39. WHEN a user hovers over a non-active nav item, THE Sidebar SHALL display a subtle accent background color
40. THE Sidebar SHALL use visual dividers to separate "Core" navigation items (Dashboard, Team, Tasks, Review) from "Team Ops" items (Analytics, Attendance, Leave, Bot, etc.)
41. THE Sidebar SHALL display the user avatar at the bottom with a live StatusDot component showing the user's current session state
42. THE Sidebar SHALL display a theme toggle (dark/light mode switch) centered above the user section

##### Session State Colors and StatusDot

43. THE App SHALL define session state colors: gold with emerald pulse for active, amber/orange for on-break, muted gray for away, and very faint muted for offline
44. THE App SHALL provide a StatusDot component that renders a small colored circle reflecting the user's current session state
45. WHEN the session state is active, THE StatusDot SHALL display an emerald green pulse animation (ping effect)
46. WHEN the session state is on-break, THE StatusDot SHALL display a static amber/orange circle without animation
47. WHEN the session state is away or offline, THE StatusDot SHALL display a static muted gray or very faint muted circle without animation

##### CSS Animations (No Framer Motion)

48. THE App SHALL define the following custom animations in CSS (using Framer Motion for complex orchestrated transitions where needed), including:
    - `glow-pulse`: a 4-second breathing glow for ambient effects
    - `float`: a 5-second gentle vertical bob
    - `breathe`: a 3-second opacity pulse
    - `slide-up-fade`: a 350ms entry animation for cards and content
    - `scale-in`: a 250ms scale entry for modals
    - `hover-lift`: a GPU-accelerated `translateY` on hover with `will-change` optimization
49. THE App SHALL target screen transitions under 200ms
50. WHEN a user presses a button, THE App SHALL apply `scale(0.97)` via `data-pressed` data attribute styling

##### Light/Dark Theme Micro-Details

51. THE App SHALL use dark mode as the default theme
52. WHILE light mode is active, THE glass surfaces SHALL use higher-opacity white insets and shadows that shift from black to warm brown tones
53. WHILE light mode is active, THE inset-well surfaces SHALL lighten to match the warm cream background
54. WHILE light mode is active, THE golden accent color SHALL shift slightly warmer and darker for improved contrast

##### Micro-Details

55. THE App SHALL apply a custom scrollbar style: 5px wide, transparent track, and a subtle thumb
56. THE glass surfaces SHALL include a noise texture overlay (SVG fractal noise) for an analog feel (already specified in criterion 13, this reinforces it)
57. THE App SHALL use gradient accent lines as section dividers between content areas
58. THE App SHALL apply focus rings of 2px offset in the primary accent color for keyboard navigation visibility
59. THE App SHALL use data attributes (`data-pressed`, `data-hovered`, `data-focused`, `data-disabled`) for state-based styling on interactive components, aligning with HeroUI's data attribute patterns

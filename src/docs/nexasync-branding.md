# NexaSync Branding Configuration

## Footer Logos

The application footer displays NexaSync branding with automatic theme switching:

### Light Mode Logo
- **URL**: `https://nexasync.ca/images/NexaSync-logo.png`
- **Display**: Visible in light theme
- **CSS Class**: `dark:hidden`

### Dark Mode Logo
- **URL**: `https://nexasync.ca/images/nexasync-white.png`
- **Display**: Visible in dark theme
- **CSS Class**: `hidden dark:block`

## Implementation Locations

1. **Footer Component**: `src/components/layout/Footer.tsx`
   - Lines 22-26: Light mode logo
   - Lines 28-32: Dark mode logo

2. **Logo Service**: `src/services/logoService.ts`
   - Lines 212-213: Default footer logos
   - Lines 222-223: Fallback footer logos

3. **Company Logos Hook**: `src/hooks/useCompanyLogos.ts`
   - Lines 11-12: Initial state with NexaSync logos

## Features

- **Automatic Theme Switching**: Logos automatically switch based on user's theme preference
- **Fallback Support**: If custom logos aren't set, NexaSync logos are used as defaults
- **Cross-Device Sync**: Logo preferences sync across devices via localStorage
- **Responsive Sizing**: Logos scale appropriately with `h-4` height class
- **Subtle Branding**: Applied `opacity-60` for non-intrusive footer presence

## Copyright Notice

Footer includes: `© {currentYear} NexaSync. All rights reserved.`

---

*Last Updated: December 2024*
# MedEx Logo Installation Instructions

## Save Your Logo Here

Please save the MedEx logo image you provided as:
- **File path**: `public/images/medex-logo.png`

The logo should be:
- Format: PNG (recommended) or SVG
- Dimensions: Recommended 300x100px (or similar aspect ratio)
- Transparent background: Yes (for better integration)

## Logo Files to Create/Replace:

1. **Main Header Logo**: `public/images/medex-logo.png`
   - Used in: Header, Login page
   - Size: ~300x100px

2. **Favicon**: `public/images/medex-favicon.png`
   - Used in: Browser tab icon
   - Size: 32x32px or 64x64px
   - Format: PNG or ICO

3. **PWA Icons** (optional but recommended):
   - `public/images/medex-icon-192.png` (192x192px)
   - `public/images/medex-icon-512.png` (512x512px)

## Logo Usage in Code

The logo is referenced in:
- `src/services/logoService.ts` - Line 211
- `index.html` - Favicon links (lines 5-6)
- `public/manifest.json` - PWA icons

## Current Logo Files to Remove/Replace

Old CareXPS logo files (can be deleted after MedEx logo is added):
- `public/images/Logo.png` (old CareXPS logo)
- Any other CareXPS branded images

## Next Steps

1. Save your MedEx logo as `medex-logo.png` in this directory
2. Create a favicon version as `medex-favicon.png`
3. Optionally create PWA icons for mobile installations
4. Update logo service configuration (see MEDEX_SETUP_GUIDE.md)

# PWA Icons for GenPwd Pro

This directory contains the PWA (Progressive Web App) icons for GenPwd Pro.

## Required Icon Sizes

The following icon sizes are required for full PWA compatibility:

- **72x72** - Android Chrome, small icon
- **96x96** - Android Chrome, medium icon
- **128x128** - Android Chrome, large icon
- **144x144** - Windows tile
- **152x152** - iOS Safari
- **192x192** - Android Chrome, standard icon
- **384x384** - Android Chrome, high-res icon
- **512x512** - Android Chrome, splash screen

## Icon Design Guidelines

### Design Specifications
- **Base Color**: `#4CAF50` (GenPwd Pro brand green)
- **Background**: White (`#FFFFFF`) or transparent
- **Logo**: Shield with lock/password symbol
- **Style**: Modern, flat design with slight gradients
- **Padding**: 10% margin from edges for safe area

### Recommended Design
The icon should feature:
1. **Shield Shape**: Security-focused design
2. **Lock/Key Symbol**: Password generation theme
3. **Clean Typography**: "GP" or "GenPwd" text (optional for smaller sizes)
4. **Gradient**: Linear gradient from `#667eea` to `#764ba2` (brand colors)

## How to Generate Icons

### Option 1: Using Figma/Adobe Illustrator
1. Create a 512x512px artboard
2. Design the icon following the guidelines above
3. Export as PNG in all required sizes
4. Save files as: `icon-{size}.png` (e.g., `icon-72x72.png`)

### Option 2: Using Online Tools
1. Create a 512x512px base icon
2. Use tools like:
   - https://realfavicongenerator.net/
   - https://www.pwabuilder.com/imageGenerator
   - https://favicon.io/favicon-generator/
3. Upload your 512x512 icon and generate all sizes
4. Download and place in this directory

### Option 3: Using ImageMagick (Command Line)
```bash
# From a 512x512 source icon (icon-512x512.png)
convert icon-512x512.png -resize 72x72 icon-72x72.png
convert icon-512x512.png -resize 96x96 icon-96x96.png
convert icon-512x512.png -resize 128x128 icon-128x128.png
convert icon-512x512.png -resize 144x144 icon-144x144.png
convert icon-512x512.png -resize 152x152 icon-152x152.png
convert icon-512x512.png -resize 192x192 icon-192x192.png
convert icon-512x512.png -resize 384x384 icon-384x384.png
```

### Option 4: Using Sharp (Node.js)
```javascript
const sharp = require('sharp');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

sizes.forEach(size => {
  sharp('source-icon.png')
    .resize(size, size)
    .toFile(`icon-${size}x${size}.png`);
});
```

## Placeholder Icons

If you don't have custom icons yet, you can use placeholder icons:
1. Create a simple colored square with the app initials "GP"
2. Or use https://placeholder.com/ for quick placeholders
3. Ensure all required sizes are present before deploying

## File Naming Convention

All icon files should follow this naming pattern:
- `icon-72x72.png`
- `icon-96x96.png`
- `icon-128x128.png`
- `icon-144x144.png`
- `icon-152x152.png`
- `icon-192x192.png`
- `icon-384x384.png`
- `icon-512x512.png`

## Validation

After generating icons:
1. Check that all 8 sizes are present
2. Verify that each icon is the correct dimensions
3. Test PWA installation on mobile device
4. Run Lighthouse audit to verify PWA requirements (target: 100 score)

## Additional Assets

### Apple Touch Icons
For iOS devices, also include:
- `apple-touch-icon.png` (180x180)

### Favicon
For browser tabs:
- `favicon.ico` (32x32, 16x16 multi-resolution)
- `favicon-16x16.png`
- `favicon-32x32.png`

## License

All icons are part of GenPwd Pro and are subject to the Apache License 2.0.

```
Copyright 2025 Julien Bombled

Licensed under the Apache License, Version 2.0 (the "License");
you may not use these files except in compliance with the License.
```

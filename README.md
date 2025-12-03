# Node SSG - Static Site Generator

A lightweight, fast static site generator with live reload and frontmatter support. **Just 345 lines of code.**

## Features

- **Markdown & HTML Support** - Write pages in Markdown or HTML
- **Frontmatter** - YAML frontmatter for page metadata
- **Layouts & Partials** - Reusable templates and components
- **Template Variables** - Use frontmatter data in your templates
- **Live Reload** - Automatic page refresh on changes
- **Pretty URLs** - Clean URLs without .html extensions
- **Fast Builds** - Parallel page processing
- **Simple** - Easy to understand and customize

## Installation

```bash
npm install
```

## Quick Start

### Development Mode

Start the development server with live reload:

```bash
npm run dev
```

Server runs at http://localhost:8000

### Production Build

Build your site for production:

```bash
npm run build
```

Generated files go to the `dist/` directory.

## Project Structure

```
├── src/
│   ├── pages/          # Your site pages (.md or .html)
│   │   ├── index.md
│   │   └── about.md
│   ├── layouts/        # Page layouts
│   │   └── default.html
│   ├── partials/       # Reusable components
│   │   └── header.html
│   └── assets/         # Static assets (CSS, JS, images)
│       ├── css/
│       ├── js/
│       └── images/
└── dist/              # Generated site (auto-created)
```

## Usage

### Pages with Frontmatter

Create pages in `src/pages/` using Markdown or HTML with YAML frontmatter:

**Markdown example** (`src/pages/about.md`):
```markdown
---
title: About Us
layout: default
description: Learn more about our company
---

# About Us

This is the about page.
```

**HTML example** (`src/pages/contact.html`):
```html
---
title: Contact
layout: default
---

<h1>Contact Us</h1>
<p>Get in touch!</p>
```

**Frontmatter fields:**
- `title` - Page title (accessible as `{{ title }}` in layouts)
- `layout` - Layout to use (defaults to "default")
- Any custom fields you want to use in templates

### Layouts

Create layouts in `src/layouts/`. Use `{{ content }}` for page content and `{{ variable }}` for frontmatter data:

**`src/layouts/default.html`**:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>{{ title }}</title>
  <meta name="description" content="{{ description }}">
  <link rel="stylesheet" href="/assets/css/style.css">
</head>
<body>
  {{ header }}
  <main>
    {{ content }}
  </main>
  {{ footer }}
</body>
</html>
```

**Template syntax:**
- `{{ content }}` - Inserts page content
- `{{ variable }}` - Inserts frontmatter variable (e.g., `{{ title }}`, `{{ author }}`)
- `{{ partial-name }}` - Includes a partial (e.g., `{{ header }}`, `{{ footer }}`)

### Partials

Create reusable components in `src/partials/`. Include them with `{{ name }}`:

**`src/partials/header.html`**:
```html
<header>
  <h1>My Site</h1>
  <nav>
    <a href="/">Home</a>
    <a href="/about">About</a>
  </nav>
</header>
```

**Using partials:**
```html
{{ header }}
{{ components/button }}
```

Partials can be organized in subdirectories.

### Pretty URLs

Pages are automatically converted to pretty URLs:

- `src/pages/index.md` → `/index.html` → `http://localhost:8000/`
- `src/pages/about.md` → `/about/index.html` → `http://localhost:8000/about`
- `src/pages/blog/post.md` → `/blog/post/index.html` → `http://localhost:8000/blog/post`

### Assets

Place static assets in `src/assets/`:

- CSS: `src/assets/css/style.css` → `/assets/css/style.css`
- JavaScript: `src/assets/js/app.js` → `/assets/js/app.js`
- Images: `src/assets/images/logo.png` → `/assets/images/logo.png`

Reference them in your layouts:
```html
<link rel="stylesheet" href="/assets/css/style.css">
<script src="/assets/js/app.js"></script>
<img src="/assets/images/logo.png" alt="Logo">
```

## Live Reload

In development mode, the site automatically reloads when you make changes to any file in `src/`. The live reload script is automatically injected into HTML pages.

## Configuration

Default settings (edit `cli.js` to change):
- **Source directory**: `src/`
- **Output directory**: `dist/`
- **Dev server port**: `8000`
- **Debounce delay**: `120ms`

## CLI Commands

```bash
node cli.js build    # Build the site
node cli.js dev      # Start development server
```

Or use npm scripts:
```bash
npm run build
npm run dev
```

## Dependencies

- **[marked](https://www.npmjs.com/package/marked)** - Markdown parser
- **[chokidar](https://www.npmjs.com/package/chokidar)** - File watcher
- **[sirv](https://www.npmjs.com/package/sirv)** - Static file server
- **[gray-matter](https://www.npmjs.com/package/gray-matter)** - Frontmatter parser

## Example: Blog Post

**`src/pages/blog/my-first-post.md`**:
```markdown
---
title: My First Blog Post
layout: blog
author: Jane Doe
date: 2025-01-15
---

# My First Blog Post

This is my first post!
```

**`src/layouts/blog.html`**:
```html
<!DOCTYPE html>
<html>
<head>
  <title>{{ title }}</title>
</head>
<body>
  <article>
    <header>
      <h1>{{ title }}</h1>
      <p>By {{ author }} on {{ date }}</p>
    </header>
    {{ content }}
  </article>
</body>
</html>
```

## How It Works

1. Reads all pages from `src/pages/`
2. Parses frontmatter from each page
3. Converts Markdown to HTML (if .md)
4. Loads the specified layout (or "default")
5. Injects page content into layout's `{{ content }}`
6. Replaces all `{{ variables }}` with frontmatter data and partials
7. Writes to `dist/` with pretty URLs

## Performance

- **Parallel builds**: All pages build concurrently
- **Simple & fast**: Full rebuilds complete in milliseconds for typical sites
- **No complexity**: No dependency tracking or incremental logic needed

## Philosophy

This SSG prioritizes **simplicity** over features:

- ✅ Easy to understand (345 lines)
- ✅ Easy to modify and extend
- ✅ Fast enough for most sites
- ✅ Minimal dependencies
- ❌ No plugins
- ❌ No complex configuration
- ❌ No incremental rebuilds

If you need more features, check out Eleventy, Hugo, or Next.js.

## Tips

1. **Organize pages**: Use subdirectories for different sections
2. **Multiple layouts**: Create blog.html, landing.html, etc.
3. **Nested partials**: Organize partials in subdirectories
4. **Custom variables**: Add any fields to frontmatter
5. **Keep it simple**: This tool works best for straightforward static sites

## Troubleshooting

**Port 8000 in use**:
- Kill the process using port 8000, or
- Edit PORT in cli.js

**Changes not reflecting**:
- Check the dev server is running
- Verify files are in `src/`
- Clear browser cache

**Build errors**:
- Check console for error details
- Verify frontmatter YAML is valid
- Ensure layout files exist

**Layout not found**:
- Layout file must exist in `src/layouts/`
- Use `layout: default` in frontmatter
- Layout names are case-sensitive

## License

MIT

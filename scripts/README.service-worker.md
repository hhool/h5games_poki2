# Service Worker and PWA Support

## Overview

This project implements a comprehensive Service Worker for caching and offline support, transforming the web app into a Progressive Web App (PWA) with offline capabilities.

## Features

### 1. Service Worker Implementation
- **Cache Strategies**: Implements multiple caching strategies for different resource types
- **Offline Support**: Provides offline page when network is unavailable
- **Background Sync**: Supports background synchronization for offline actions
- **Push Notifications**: Framework for push notification handling

### 2. Caching Strategies

#### Cache-First (Static Assets)
- CSS, JavaScript, images, and other static resources
- Fast loading from cache, network fallback

#### Network-First (API Calls)
- Games data and dynamic content
- Always tries network first, falls back to cache

#### Stale-While-Revalidate (Other Resources)
- HTML pages and miscellaneous resources
- Serves from cache immediately while updating in background

### 3. Web App Manifest
- **PWA Metadata**: App name, description, icons
- **Display Mode**: Standalone app experience
- **Theme Colors**: Brand-consistent theming
- **Installation**: Add to home screen support

### 4. Offline Experience
- **Offline Page**: Custom offline page with retry functionality
- **Graceful Degradation**: Maintains functionality when offline
- **Network Detection**: Automatic redirect when connection restored

## Technical Implementation

### Service Worker Registration
```javascript
// Automatic registration with update handling
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(registration => {
      // Handle updates and new versions
    });
}
```

### Cache Management
```javascript
// Multiple cache buckets for different strategies
const STATIC_CACHE = 'poki2-static-v1.0.0';
const DYNAMIC_CACHE = 'poki2-dynamic-v1.0.0';
```

### Offline Detection
```javascript
// Network status monitoring
window.addEventListener('online', () => {
  // Handle reconnection
});
```

## File Structure

```
public/
  sw.js              # Service Worker implementation
  manifest.json      # Web App Manifest
  offline.html       # Offline fallback page
```

## Cache Strategy Details

### Static Assets (Cache-First)
- `/css/styles.css`
- `/js/app.bundle.js`
- `/favicon.png`, `/favicon.webp`
- `/manifest.json`

### API Endpoints (Network-First)
- `/games.json`

### HTML Pages (Network-First with Offline Fallback)
- All HTML pages fall back to `/offline.html` when offline

### External Resources (Network Only)
- Game iframes and external links are not cached

## Performance Benefits

- **Faster Loading**: Cached resources load instantly
- **Offline Functionality**: Core app works without internet
- **Reduced Bandwidth**: Cached content reduces data usage
- **Improved UX**: Seamless experience across network conditions

## Browser Support

- **Service Worker**: Chrome 40+, Firefox 44+, Safari 11.1+, Edge 17+
- **Web App Manifest**: All modern browsers
- **Cache API**: Same as Service Worker support

## Development Notes

### Cache Versioning
- Cache names include version numbers for proper invalidation
- Automatic cleanup of old cache versions

### Update Handling
- Detects new Service Worker versions
- Prompts user to reload for updates

### Debug Mode
- Console logging for cache operations
- Easy debugging of offline scenarios

## Testing Offline Functionality

1. **Browser DevTools**: Use Network tab to simulate offline
2. **Service Worker Panel**: Monitor cache contents and status
3. **Application Panel**: Test "Add to Home Screen" functionality

## Future Enhancements

- **Advanced Caching**: Implement more sophisticated cache strategies
- **Push Notifications**: Add real push notification functionality
- **Background Sync**: Implement actual background synchronization
- **Install Prompts**: Add custom install prompts and banners
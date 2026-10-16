import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        home: 'index.html',
        property: 'property.html',
        propertySearch: 'property-search.html',
        privacy: 'privacy.html'
      }
    }
  }
});


if (typeof process.setSourceMapsEnabled === 'function') {
  process.setSourceMapsEnabled(true)
}

void import('./app')

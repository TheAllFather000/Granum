window.GRANUM_API_URL = 'https://unhid-untriflingly-georgiann.ngrok-free.dev';
if (!localStorage.getItem('granum_api_url')) {
  localStorage.setItem('granum_api_url', 'https://unhid-untriflingly-georgiann.ngrok-free.dev');
}

// ngrok free tunnels can return a browser warning page without this header.
// Add it automatically for all requests targeting ngrok domains.
(function patchFetchForNgrok() {
  if (typeof window.fetch !== 'function') return;
  const originalFetch = window.fetch.bind(window);

  window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const isNgrok = typeof url === 'string' && url.includes('ngrok-free.dev');
    if (!isNgrok) return originalFetch(input, init);

    const headers = new Headers((init && init.headers) || (typeof input !== 'string' ? input.headers : undefined) || {});
    if (!headers.has('ngrok-skip-browser-warning')) {
      headers.set('ngrok-skip-browser-warning', 'true');
    }

    if (typeof input === 'string') {
      return originalFetch(input, { ...(init || {}), headers });
    }

    const request = new Request(input, { ...(init || {}), headers });
    return originalFetch(request);
  };
})();
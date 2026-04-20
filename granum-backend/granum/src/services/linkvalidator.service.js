const https = require('https');
const http = require('http');

const PLATFORM_DOMAINS = {
  facebook: ['facebook.com', 'fb.com', 'm.facebook.com', '/business.facebook.com'],
  instagram: ['instagram.com', 'www.instagram.com'],
  whatsapp: ['wa.me', 'whatsapp.com', 'web.whatsapp.com'],
  twitter: ['twitter.com', 'x.com', 'mobile.twitter.com', 'mobile.x.com'],
  tiktok: ['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com'],
  website: null,  // any domain allowed
};

const PLATFORM_REGEX = {
  facebook: /facebook\.com\/(?:[\w.-]+\/)?(?:page(?:\?|\/)|community|gaming|business|groups|\d+)/i,
  instagram: /instagram\.com\/(?!direct|stories|reels|explore)([\w.-]+)\/?$/i,
  whatsapp: /wa\.me\/\d+/i,
  twitter: /(twitter|x)\.com\/\w+/i,
  tiktok: /tiktok\.com\/@[\w.-]+/i,
};

function parseUrl(urlStr) {
  try {
    return new URL(urlStr);
  } catch {
    return null;
  }
}

function getHostname(url) {
  const hostname = url.hostname.toLowerCase();
  return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
}

function isValidDomain(url, allowedDomains) {
  if (!allowedDomains) return true;  // any domain allowed (for website)
  const hostname = getHostname(url);
  return allowedDomains.some(d => hostname === d || hostname.endsWith('.' + d));
}

async function checkUrl(urlStr, platform) {
  return new Promise((resolve) => {
    const url = parseUrl(urlStr);
    if (!url) {
      return resolve({ valid: false, reason: 'Invalid URL format' });
    }

    const allowedDomains = PLATFORM_DOMAINS[platform];
    
    if (!isValidDomain(url, allowedDomains)) {
      return resolve({ valid: false, reason: `URL must be from ${platform}.com or related domains` });
    }

    const protocol = url.protocol === 'https:' ? https : http;
    const req = protocol.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'HEAD',
      timeout: 5000,
    }, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        resolve({ valid: true, statusCode: res.statusCode });
      } else if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // follow redirect
        resolve(checkUrl(res.headers.location, platform));
      } else {
        resolve({ valid: false, reason: `Server returned ${res.statusCode}` });
      }
    });

    req.on('error', (err) => {
      resolve({ valid: false, reason: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ valid: false, reason: 'Connection timeout' });
    });

    req.end();
  });
}

async function verifyLinks(socialLinks) {
  const results = [];
  
  for (const link of socialLinks) {
    const { platform, url } = link;
    const check = await checkUrl(url, platform);
    results.push({
      platform,
      url,
      valid: check.valid,
      reason: check.reason || null,
    });
  }
  
  return results;
}

module.exports = { verifyLinks, checkUrl, PLATFORM_DOMAINS };
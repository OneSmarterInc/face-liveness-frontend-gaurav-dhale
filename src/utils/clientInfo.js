// Lightweight User-Agent parsing — good enough for the evidence payload's
// `client.browser` / `client.os` fields. Not a full UA-parsing library, and
// on Chromium/Linux the UA string doesn't expose the distro version (that
// needs `navigator.userAgentData.getHighEntropyValues`, not available in
// all browsers) — this falls back to a generic "Linux" there.

function detectBrowser(ua) {
  const patterns = [
    { name: "Edge", regex: /Edg\/([\d.]+)/ },
    { name: "Chrome", regex: /Chrome\/([\d.]+)/ },
    { name: "Firefox", regex: /Firefox\/([\d.]+)/ },
    { name: "Safari", regex: /Version\/([\d.]+).*Safari/ },
  ];

  for (const { name, regex } of patterns) {
    const match = ua.match(regex);
    if (match) return `${name} ${match[1].split(".")[0]}`;
  }

  return "Unknown";
}

function detectOS(ua) {
  if (/Windows NT 10/.test(ua)) return "Windows 10";
  if (/Windows NT/.test(ua)) return "Windows";

  const mac = ua.match(/Mac OS X ([\d_]+)/);
  if (mac) return `macOS ${mac[1].replaceAll("_", ".")}`;

  const android = ua.match(/Android ([\d.]+)/);
  if (android) return `Android ${android[1]}`;

  const ios = ua.match(/iPhone OS ([\d_]+)/);
  if (ios) return `iOS ${ios[1].replaceAll("_", ".")}`;

  if (/Linux/.test(ua)) return "Linux";

  return "Unknown";
}

export function getClientInfo() {
  const ua = navigator.userAgent || "";

  return {
    platform: "web",
    app_version:
      typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0",
    browser: detectBrowser(ua),
    os: detectOS(ua),
  };
}

/* ==========================================================================
   ui/icons.js — אייקוני קו: רשת 24, קו 1.8, פינות מעוגלות.
   לאיורים הצבעוניים של הקטגוריות ראו ui/art.js.
   ========================================================================== */
window.P = window.P || {};

P.icons = (function () {
  'use strict';

  const G = P.dict({
    home:     '<path d="M4 10.8 12 4l8 6.8V19a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19z"/>',
    calendar: '<rect x="3.8" y="5.2" width="16.4" height="15" rx="2.6"/><path d="M3.8 9.8h16.4M8.2 3.2v4M15.8 3.2v4"/><path d="M8 13.6h2.2M13.8 13.6H16M8 17h2.2"/>',
    grid:     '<rect x="4" y="4" width="6.6" height="6.6" rx="1.8"/><rect x="13.4" y="4" width="6.6" height="6.6" rx="1.8"/><rect x="4" y="13.4" width="6.6" height="6.6" rx="1.8"/><rect x="13.4" y="13.4" width="6.6" height="6.6" rx="1.8"/>',
    list:     '<path d="M9.5 6.5h10M9.5 12h10M9.5 17.5h10"/><path d="M4.75 6.5h.01M4.75 12h.01M4.75 17.5h.01"/>',
    chart:    '<path d="M4 20h16"/><path d="M7.5 16v-5M12 16V5.5M16.5 16v-8"/>',
    pie:      '<path d="M12 3.5V12h8.5"/><path d="M20.3 15.4A8.6 8.6 0 1 1 8.6 4.1"/>',
    inbox:    '<path d="M4 13.5 6.4 5.5h11.2l2.4 8V19H4z"/><path d="M4 13.5h4.6l1.1 2.2h4.6l1.1-2.2H20"/>',
    sliders:  '<path d="M4 7h9.5M17.5 7H20M4 17h3.5M11.5 17H20"/><circle cx="15.5" cy="7" r="2"/><circle cx="9.5" cy="17" r="2"/>',
    gear:     '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
    upload:   '<path d="M12 15V4.5M7.5 9 12 4.5 16.5 9"/><path d="M4.5 14.5v4A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-4"/>',
    download: '<path d="M12 4.5V15M7.5 10.5 12 15l4.5-4.5"/><path d="M4.5 14.5v4A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-4"/>',
    moon:     '<path d="M19.5 14.6A7.8 7.8 0 0 1 9.4 4.5a7.8 7.8 0 1 0 10.1 10.1z"/>',
    sun:      '<circle cx="12" cy="12" r="4"/><path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4"/>',
    palette:  '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.3 0 1.8-1 1.4-2-.5-1.3.2-2.5 1.6-2.5H17a3.5 3.5 0 0 0 3.5-3.5c0-5-3.8-9-8.5-9z"/><circle cx="7.8" cy="11" r="1.1"/><circle cx="10.3" cy="7.4" r="1.1"/><circle cx="14.6" cy="7.6" r="1.1"/>',
    edit:     '<path d="M4.5 19.5h3.8L19 8.8 15.2 5 4.5 15.7z"/><path d="m13.3 6.9 3.8 3.8"/>',
    chevron:  '<path d="m14.5 6-6 6 6 6"/>',
    chevronR: '<path d="m9.5 6 6 6-6 6"/>',
    chevronD: '<path d="m6 9.5 6 6 6-6"/>',
    search:   '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    check:    '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    spark:    '<path d="M12 3.5 13.8 9 19.5 10.8 13.8 12.6 12 18.5 10.2 12.6 4.5 10.8 10.2 9z"/>',
    folder:   '<path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h3.8l2 2h7.2a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
    close:    '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    plus:     '<path d="M12 5.5v13M5.5 12h13"/>',
    file:     '<path d="M6.5 3.5h7.5l4.5 4.5v12.5h-12z"/><path d="M14 3.5V8h4.5"/>',
    eyeOff:   '<path d="M3.5 12s3-6 8.5-6c1.6 0 3 .5 4.2 1.2M20.5 12s-3 6-8.5 6c-1.6 0-3-.5-4.2-1.2"/><path d="M4.5 19.5l15-15"/>',
    trendUp:  '<path d="M3.5 17 9.5 11l4 4 7-7.5"/><path d="M15.5 7.5h5v5"/>',
    trendDown:'<path d="M3.5 7 9.5 13l4-4 7 7.5"/><path d="M15.5 16.5h5v-5"/>',
    repeat:   '<path d="M17 3.5 20 6.5 17 9.5"/><path d="M4 11.5V10a3.5 3.5 0 0 1 3.5-3.5H20"/><path d="M7 20.5 4 17.5l3-3"/><path d="M20 12.5V14a3.5 3.5 0 0 1-3.5 3.5H4"/>',
    alert:    '<path d="M12 4.2 21 19.5H3z"/><path d="M12 10v4.2M12 17h.01"/>',
    wallet:   '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11V8"/><path d="M4 7.5V17a2.5 2.5 0 0 0 2.5 2.5h13V9h-13A2.5 2.5 0 0 1 4 7.5z"/><circle cx="16" cy="14.2" r="1.2"/>',
    lock:     '<rect x="5" y="10.5" width="14" height="10" rx="2.4"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5"/>',
    more:     '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
    filter:   '<path d="M4 6h16M7 12h10M10 18h4"/>',
    coins:    '<ellipse cx="9" cy="7.5" rx="5.5" ry="2.5"/><path d="M3.5 7.5v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-4"/><path d="M9.5 16.5c.8 1.2 3 2 5.5 2 3 0 5.5-1.1 5.5-2.5v-4c0-1.2-1.8-2.2-4.2-2.4"/>',
    store:    '<path d="M4.5 9.5V20h15V9.5"/><path d="M3 9.5 5 4h14l2 5.5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M10 20v-5h4v5"/>',
    undo:     '<path d="M9 7.5 4.5 12 9 16.5"/><path d="M4.5 12H15a4.5 4.5 0 0 1 0 9h-2"/>',
    trash:    '<path d="M4.5 7h15M10 11v6M14 11v6"/><path d="M6.5 7l1 12.5a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4L17.5 7"/><path d="M9.5 7V4.5h5V7"/>',
    tag:      '<path d="M3.5 11.6V4.5a1 1 0 0 1 1-1h7.1l9 9a1 1 0 0 1 0 1.4l-7.1 7.1a1 1 0 0 1-1.4 0z"/><circle cx="8" cy="8" r="1.4"/>',
    keyboard: '<rect x="2.8" y="6" width="18.4" height="12" rx="2.4"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14.2h9"/>',
    bolt:     '<path d="M13 3 5.5 13.5H12L11 21l7.5-10.5H12z"/>',
    target:   '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/>',
    compass:  '<circle cx="12" cy="12" r="8.6"/><path d="m15.4 8.6-2.1 4.7-4.7 2.1 2.1-4.7z"/>',
    seal:     '<path d="m12 3 2.2 1.6 2.7-.1.8 2.6 2.2 1.6-.9 2.6.9 2.6-2.2 1.6-.8 2.6-2.7-.1L12 21l-2.2-1.6-2.7.1-.8-2.6-2.2-1.6.9-2.6-.9-2.6 2.2-1.6.8-2.6 2.7.1z"/><path d="m8.8 12.2 2.2 2.2 4.2-4.4"/>'
  });

  function svg(name, size, cls) {
    const s = size || 18;
    const wrap = document.createElement('span');
    wrap.className = 'ico' + (cls ? ' ' + cls : '');
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (G[name] || G.spark) + '</svg>';
    return wrap;
  }

  return { svg: svg, names: Object.keys(G) };
})();

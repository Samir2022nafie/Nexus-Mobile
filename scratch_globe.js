const fs = require('fs');

fetch('https://unpkg.com/maplibre-gl@5.1.0/dist/maplibre-gl.js')
  .then(r => r.text())
  .then(text => {
    let idx = 0;
    while ((idx = text.indexOf('atmosphere-blend', idx)) !== -1) {
      console.log('--- MATCH at', idx, '---');
      console.log(text.substring(idx - 120, idx + 250));
      idx += 16;
    }
  });

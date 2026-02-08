const en = require('./src/locales/en.json');
const fr = require('./src/locales/fr.json');

function findMissing(frObj, enObj, path = '') {
  const missing = [];
  for (const key in frObj) {
    const newPath = path ? path + '.' + key : key;
    if (!(key in enObj)) {
      missing.push(newPath);
    } else if (typeof frObj[key] === 'object' && frObj[key] !== null && !Array.isArray(frObj[key])) {
      missing.push(...findMissing(frObj[key], enObj[key] || {}, newPath));
    }
  }
  return missing;
}

const missing = findMissing(fr, en);
console.log('Missing keys in en.json: ' + missing.length);
missing.forEach(k => console.log(k));

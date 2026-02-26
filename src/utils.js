function clampInt(n, min, max){
  n = Math.trunc(Number(n));
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
}

function fmt(n){ return new Intl.NumberFormat("ar-KW").format(n); }

function randInt(min, max){
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

module.exports = { clampInt, fmt, randInt, pick };

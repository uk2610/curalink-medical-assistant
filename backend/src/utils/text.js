function normalizeText(value) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 2);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function clip(text, maxLen = 350) {
  if (!text) {
    return "";
  }

  return text.length > maxLen ? `${text.slice(0, maxLen - 3)}...` : text;
}

module.exports = {
  normalizeText,
  tokenize,
  unique,
  clip
};

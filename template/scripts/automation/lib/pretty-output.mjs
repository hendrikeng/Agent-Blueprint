const PRETTY_SPINNER_FRAMES = ['|', '/', '-', '\\'];
const PRETTY_LIVE_DOT_FRAMES = ['...', '.. ', '.  ', ' ..'];

let prettySpinnerIndex = 0;
let prettyLiveDotIndex = 0;
let liveStatusLineLength = 0;

export function canUseColor(logging) {
  if (logging.mode !== 'pretty') {
    return false;
  }
  if (!process.stdout.isTTY) {
    return false;
  }
  if (String(process.env.NO_COLOR ?? '').trim() !== '') {
    return false;
  }
  return String(process.env.TERM ?? '').trim().toLowerCase() !== 'dumb';
}

export function colorize(logging, code, text) {
  if (!canUseColor(logging)) {
    return text;
  }
  return `\x1b[${code}m${text}\x1b[0m`;
}

export function nextPrettySpinner(logging) {
  if (!process.stdout.isTTY) {
    return '.';
  }
  const frame = PRETTY_SPINNER_FRAMES[prettySpinnerIndex % PRETTY_SPINNER_FRAMES.length];
  prettySpinnerIndex += 1;
  return colorize(logging, '36', frame);
}

export function nextPrettyLiveDots(logging) {
  if (!process.stdout.isTTY) {
    return '...';
  }
  const frame = PRETTY_LIVE_DOT_FRAMES[prettyLiveDotIndex % PRETTY_LIVE_DOT_FRAMES.length];
  prettyLiveDotIndex += 1;
  return colorize(logging, '36', frame);
}

function prettyLevelColor(level = 'run') {
  if (level === 'ok') {
    return '32';
  }
  if (level === 'warn') {
    return '33';
  }
  if (level === 'err' || level === 'error') {
    return '31';
  }
  return '36';
}

export function prettyLevelTag(logging, level = 'run') {
  if (level === 'ok') {
    return colorize(logging, prettyLevelColor(level), 'OK  ');
  }
  if (level === 'warn') {
    return colorize(logging, prettyLevelColor(level), 'WARN');
  }
  if (level === 'err' || level === 'error') {
    return colorize(logging, prettyLevelColor(level), 'ERR ');
  }
  return colorize(logging, prettyLevelColor(level), 'RUN ');
}

export function prettyTimedLevelTag(logging, level = 'run', elapsedLabel = '00:00') {
  let label = 'RUN';
  if (level === 'working') {
    label = 'WORKING';
  } else if (level === 'ok') {
    label = 'OK';
  } else if (level === 'warn') {
    label = 'WARN';
  } else if (level === 'err' || level === 'error') {
    label = 'ERR';
  }
  const paddedLabel = label.padEnd(7, ' ');
  const paletteLevel = level === 'working' ? 'run' : level;
  return colorize(logging, prettyLevelColor(paletteLevel), `${paddedLabel} (${String(elapsedLabel || '00:00')})`);
}

export function stripAnsiControl(value) {
  return String(value ?? '').replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
}

export function escapeRegex(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function visibleTextLength(value) {
  return stripAnsiControl(value).length;
}

function wrapTextForConsole(text, maxWidth) {
  const rendered = String(text ?? '').trim();
  if (!rendered) {
    return [''];
  }
  if (!Number.isFinite(maxWidth) || maxWidth <= 0) {
    return [rendered];
  }

  const words = rendered.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  const splitLongToken = (token) => {
    let remaining = token;
    while (remaining.length > maxWidth) {
      lines.push(remaining.slice(0, maxWidth));
      remaining = remaining.slice(maxWidth);
    }
    return remaining;
  };

  for (const word of words) {
    if (!current) {
      current = word.length <= maxWidth ? word : splitLongToken(word);
      continue;
    }
    if (current.length + 1 + word.length <= maxWidth) {
      current = `${current} ${word}`;
      continue;
    }
    lines.push(current);
    current = word.length <= maxWidth ? word : splitLongToken(word);
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [rendered];
}

export function printIndentedPrettyMessage(prefix, message) {
  const renderedPrefix = String(prefix ?? '');
  const renderedMessage = String(message ?? '').trim();
  if (!renderedMessage) {
    console.log(renderedPrefix.trimEnd());
    return;
  }

  const visiblePrefixLength = visibleTextLength(renderedPrefix);
  const consoleWidth =
    process.stdout.isTTY && Number.isFinite(process.stdout.columns) ? Number(process.stdout.columns) : 0;
  const maxWidth = consoleWidth > visiblePrefixLength + 12 ? consoleWidth - visiblePrefixLength : 0;
  const visibleMessage = stripAnsiControl(renderedMessage);
  if (!Number.isFinite(maxWidth) || maxWidth <= 0 || visibleMessage.length <= maxWidth) {
    console.log(`${renderedPrefix}${renderedMessage}`);
    return;
  }
  const lines = wrapTextForConsole(visibleMessage, maxWidth);

  console.log(`${renderedPrefix}${lines[0] ?? ''}`);
  if (lines.length <= 1) {
    return;
  }

  const continuationPrefix = ' '.repeat(Math.max(0, visiblePrefixLength));
  for (const line of lines.slice(1)) {
    console.log(`${continuationPrefix}${line}`);
  }
}

function parseStructuredLogMessage(message) {
  const normalized = String(message ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return { headline: '', details: [] };
  }
  if (normalized.includes(' | ')) {
    return { headline: normalized, details: [] };
  }
  const firstDetailIndex = normalized.search(/\b[A-Za-z][A-Za-z0-9_-]*=[^\s]+/);
  if (firstDetailIndex < 0) {
    return { headline: normalized, details: [] };
  }
  const headline = normalized.slice(0, firstDetailIndex).trim();
  const detailText = normalized.slice(firstDetailIndex).trim();
  const details = [];
  const keyTokenPattern = /^([A-Za-z][A-Za-z0-9_-]*)=(.*)$/;
  let currentKey = null;
  let currentValue = '';
  for (const token of detailText.split(/\s+/)) {
    const keyMatch = token.match(keyTokenPattern);
    if (keyMatch) {
      if (currentKey && currentValue.trim()) {
        details.push({ key: currentKey, value: currentValue.trim() });
      }
      currentKey = keyMatch[1];
      currentValue = keyMatch[2] ?? '';
      continue;
    }
    if (!currentKey) {
      continue;
    }
    currentValue = currentValue ? `${currentValue} ${token}` : token;
  }
  if (currentKey && currentValue.trim()) {
    details.push({ key: currentKey, value: currentValue.trim() });
  }
  if (details.length === 0) {
    return { headline: normalized, details: [] };
  }
  return { headline: headline || normalized, details };
}

function normalizePrettyLevel(level) {
  if (level === 'err' || level === 'error') {
    return 'error';
  }
  if (level === 'warn') {
    return 'warn';
  }
  if (level === 'ok') {
    return 'ok';
  }
  return 'run';
}

function colorizeStructuredHeadline(logging, headline, level = 'run') {
  const value = String(headline ?? '').trim();
  const lower = value.toLowerCase();
  if (!value) {
    return value;
  }
  if (lower.startsWith('heartbeat') || lower.startsWith('file activity')) {
    return colorize(logging, '32', value);
  }
  if (lower.startsWith('queue ') || lower.startsWith('plan start') || lower.startsWith('session start')) {
    return colorize(logging, '36', value);
  }
  if (
    lower.startsWith('session end') ||
    lower.startsWith('session artifacts') ||
    lower.startsWith('plan continuation') ||
    lower.startsWith('role transition') ||
    lower.startsWith('working')
  ) {
    return colorize(logging, '37', value);
  }
  if (lower.startsWith('run resumed') || lower.startsWith('run start') || lower.startsWith('grind ') || lower.startsWith('run ')) {
    return colorize(logging, '36', value);
  }
  if (level === 'warn') {
    return colorize(logging, '33', value);
  }
  if (level === 'error') {
    return colorize(logging, '31', value);
  }
  if (level === 'ok') {
    return colorize(logging, '32', value);
  }
  return value;
}

function collectSemanticColorMatches(text) {
  const rendered = String(text ?? '');
  const matches = [];
  const pushMatch = (start, end, color) => {
    if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start) {
      return;
    }
    matches.push({ start, end, color });
  };

  for (const match of rendered.matchAll(/`[^`\r\n]+`/g)) {
    pushMatch(match.index ?? -1, (match.index ?? -1) + match[0].length, '94');
  }

  const scopedPatterns = [
    {
      regex: /(^|[\s([{"'])((?:[A-Za-z0-9._-]+\/)+[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+(?::\d+(?::\d+)?)?)/g,
      color: '94'
    },
    {
      regex: /(^|[\s([{"'])(\/(?:[A-Za-z0-9._~%-]+(?:\/[A-Za-z0-9._~%-\[\]]+)*)?)/g,
      color: '96'
    },
    {
      regex: /(^|[\s([{"'])(([a-z][a-z0-9_-]*:[a-z0-9_-]+))/g,
      color: '96'
    }
  ];

  for (const pattern of scopedPatterns) {
    for (const match of rendered.matchAll(pattern.regex)) {
      const prefix = match[1] ?? '';
      const token = match[2] ?? '';
      if (!token) {
        continue;
      }
      const start = (match.index ?? 0) + prefix.length;
      pushMatch(start, start + token.length, pattern.color);
    }
  }

  matches.sort((left, right) => {
    if (left.start !== right.start) {
      return left.start - right.start;
    }
    return (right.end - right.start) - (left.end - left.start);
  });

  const filtered = [];
  let lastEnd = -1;
  for (const match of matches) {
    if (match.start < lastEnd) {
      continue;
    }
    filtered.push(match);
    lastEnd = match.end;
  }
  return filtered;
}

export function colorizeSemanticText(logging, text, baseColor = null) {
  const rendered = String(text ?? '');
  if (!rendered) {
    return rendered;
  }
  if (!canUseColor(logging)) {
    return rendered;
  }

  const matches = collectSemanticColorMatches(rendered);
  if (matches.length === 0) {
    return baseColor ? colorize(logging, baseColor, rendered) : rendered;
  }

  let cursor = 0;
  let output = '';
  for (const match of matches) {
    if (match.start > cursor) {
      const before = rendered.slice(cursor, match.start);
      output += baseColor ? colorize(logging, baseColor, before) : before;
    }
    output += colorize(logging, match.color, rendered.slice(match.start, match.end));
    cursor = match.end;
  }
  if (cursor < rendered.length) {
    const tail = rendered.slice(cursor);
    output += baseColor ? colorize(logging, baseColor, tail) : tail;
  }
  return output;
}

function colorizeStructuredValue(logging, key, value, level = 'run') {
  const keyLower = String(key ?? '').trim().toLowerCase();
  const valueText = String(value ?? '').trim();
  if (!valueText) {
    return valueText;
  }

  if (keyLower === 'runid') return colorize(logging, '96', valueText);
  if (keyLower === 'plan') return colorize(logging, '36', valueText);
  if (keyLower === 'role') return colorize(logging, '35', valueText);
  if (keyLower === 'nextrole' || keyLower === 'roles') return colorize(logging, '36', valueText);
  if (keyLower === 'phase' || keyLower === 'activity') return colorize(logging, '32', valueText);
  if (keyLower === 'elapsed' || keyLower === 'idle') return colorize(logging, '32', valueText);
  if (keyLower === 'model') return colorize(logging, '96', valueText);
  if (keyLower === 'reasoning' || keyLower === 'priority') return colorize(logging, '35', valueText);
  if (keyLower === 'checkpoint' || keyLower === 'handoff' || keyLower === 'log') return colorize(logging, '90', valueText);
  if (
    keyLower === 'message' ||
    keyLower === 'reason' ||
    keyLower === 'summary' ||
    keyLower === 'nextaction' ||
    keyLower === 'live' ||
    keyLower === 'detail'
  ) {
    return colorizeSemanticText(logging, valueText, '37');
  }

  if (['risk', 'status', 'commit'].includes(keyLower)) {
    const lowerValue = valueText.toLowerCase();
    if (['completed', 'passed', 'ok', 'success', 'committed'].includes(lowerValue)) {
      return colorize(logging, '32', valueText);
    }
    if (['blocked', 'warn', 'warning', 'budget-exhausted'].includes(lowerValue)) {
      return colorize(logging, '33', valueText);
    }
    if (['failed', 'error', 'rejected'].includes(lowerValue)) {
      return colorize(logging, '31', valueText);
    }
  }

  if (level === 'warn') return colorizeSemanticText(logging, valueText, '33');
  if (level === 'error') return colorizeSemanticText(logging, valueText, '31');
  return colorize(logging, '37', valueText);
}

function printPrettyRunMessage(logging, prefix, message, level = 'run') {
  const parsed = parseStructuredLogMessage(message);
  if (parsed.details.length === 0) {
    const headlineText = String(parsed.headline ?? '').trim();
    if (!headlineText) {
      printIndentedPrettyMessage(prefix, message);
      return;
    }
    printIndentedPrettyMessage(prefix, colorizeStructuredHeadline(logging, headlineText, level));
    return;
  }

  const headlineText = String(parsed.headline ?? '').trim();
  printIndentedPrettyMessage(prefix, colorizeStructuredHeadline(logging, headlineText, level));
  const continuationPrefix = ' '.repeat(Math.max(0, visibleTextLength(prefix)));
  const keyWidth = 16;
  for (const entry of parsed.details) {
    const keyLabel = colorize(logging, '90', `${entry.key.padEnd(keyWidth, ' ')}`);
    const separator = colorize(logging, '90', ' = ');
    const valueLabel = colorizeStructuredValue(logging, entry.key, entry.value, level);
    printIndentedPrettyMessage(`${continuationPrefix}${keyLabel}${separator}`, valueLabel);
  }
}

export function printPrettyLogLine(logging, prefix, message, level = 'run') {
  const prettyLevel = normalizePrettyLevel(level);
  const renderedMessage = String(message ?? '').trim();
  if (!renderedMessage) {
    console.log(String(prefix ?? '').trimEnd());
    return;
  }

  const segments = renderedMessage
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (segments.length <= 1) {
    if (parseStructuredLogMessage(renderedMessage).details.length > 0) {
      printPrettyRunMessage(logging, prefix, renderedMessage, prettyLevel);
      return;
    }
    printIndentedPrettyMessage(prefix, colorizeStructuredHeadline(logging, renderedMessage, prettyLevel));
    return;
  }

  printIndentedPrettyMessage(prefix, colorizeStructuredHeadline(logging, segments[0], prettyLevel));
  const continuationPrefix = ' '.repeat(Math.max(0, visibleTextLength(prefix)));
  for (const line of segments.slice(1)) {
    printIndentedPrettyMessage(continuationPrefix, colorizeStructuredValue(logging, 'detail', line, prettyLevel));
  }
}

export function clearLiveStatusLine() {
  if (!process.stdout.isTTY) {
    return;
  }
  if (typeof process.stdout.clearLine === 'function' && typeof process.stdout.cursorTo === 'function') {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    liveStatusLineLength = 0;
    return;
  }
  if (liveStatusLineLength <= 0) {
    return;
  }
  process.stdout.write(`\r${' '.repeat(liveStatusLineLength)}\r`);
  liveStatusLineLength = 0;
}

export function renderLiveStatusLine(logging, message) {
  if (logging.mode !== 'pretty' || !process.stdout.isTTY) {
    return;
  }
  const normalized = String(message ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return;
  }

  const width = Number.isFinite(process.stdout.columns) ? Number(process.stdout.columns) : 0;
  const visible = stripAnsiControl(normalized);
  let rendered = normalized;
  let visibleLength = visible.length;
  if (width > 3 && visibleLength >= width) {
    const clipped = visible.slice(0, Math.max(1, width - 2)).trimEnd();
    rendered = `${clipped}…`;
    visibleLength = stripAnsiControl(rendered).length;
  }

  if (typeof process.stdout.clearLine === 'function' && typeof process.stdout.cursorTo === 'function') {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(rendered);
    liveStatusLineLength = visibleLength;
    return;
  }

  const padded = rendered.padEnd(Math.max(liveStatusLineLength, visibleLength), ' ');
  process.stdout.write(`\r${padded}`);
  liveStatusLineLength = Math.max(visibleLength, stripAnsiControl(padded).length);
}

/**
 * GenPwd Pro CLI - Password Generators
 *
 * @author Julien Bombled
 * @license Apache-2.0
 */

import { pick, randInt, insertWithPlacement, calculateEntropy } from './helpers.js';

// Syllable patterns for pronounceable passwords
const CONSONANTS = 'bcdfghjklmnprstvwxz'.split('');
const VOWELS = 'aeiou'.split('');
const SYLLABLES = [];

// Pre-generate syllables (CVC pattern)
for (const c1 of CONSONANTS) {
  for (const v of VOWELS) {
    for (const c2 of CONSONANTS) {
      SYLLABLES.push(c1 + v + c2);
    }
  }
}

// Diceware-style word list (top 1000 common words)
const WORDLIST = [
  'ability', 'able', 'about', 'above', 'accept', 'according', 'account', 'across',
  'action', 'activity', 'actually', 'address', 'administration', 'admit', 'adult',
  'affect', 'after', 'again', 'against', 'agency', 'agent', 'agree', 'agreement',
  'ahead', 'allow', 'almost', 'alone', 'along', 'already', 'also', 'although',
  'always', 'american', 'among', 'amount', 'analysis', 'animal', 'another',
  'answer', 'anyone', 'anything', 'appear', 'apply', 'approach', 'area',
  'argue', 'around', 'arrive', 'article', 'artist', 'assume', 'attack',
  'attention', 'attorney', 'audience', 'author', 'authority', 'available',
  'avoid', 'away', 'baby', 'back', 'ball', 'bank', 'base', 'beat',
  'beautiful', 'because', 'become', 'before', 'begin', 'behavior', 'behind',
  'believe', 'benefit', 'best', 'better', 'between', 'beyond', 'billion',
  'black', 'blood', 'blue', 'board', 'body', 'book', 'born', 'both',
  'break', 'bring', 'brother', 'budget', 'build', 'building', 'business',
  'call', 'camera', 'campaign', 'cancer', 'candidate', 'capital', 'card',
  'care', 'career', 'carry', 'case', 'catch', 'cause', 'cell', 'center',
  'central', 'century', 'certain', 'certainly', 'chair', 'challenge', 'chance',
  'change', 'character', 'charge', 'check', 'child', 'choice', 'choose',
  'church', 'citizen', 'city', 'civil', 'claim', 'class', 'clear', 'clearly',
  'close', 'coach', 'cold', 'collection', 'college', 'color', 'come',
  'commercial', 'common', 'community', 'company', 'compare', 'computer',
  'concern', 'condition', 'conference', 'congress', 'consider', 'consumer',
  'contain', 'continue', 'control', 'cost', 'could', 'country', 'couple',
  'course', 'court', 'cover', 'create', 'crime', 'cultural', 'culture',
  'current', 'customer', 'dark', 'data', 'daughter', 'dead', 'deal',
  'death', 'debate', 'decade', 'decide', 'decision', 'deep', 'defense',
  'degree', 'democratic', 'describe', 'design', 'despite', 'detail',
  'determine', 'develop', 'development', 'difference', 'different', 'difficult',
  'dinner', 'direction', 'director', 'discover', 'discuss', 'discussion',
  'disease', 'doctor', 'door', 'down', 'draw', 'dream', 'drive', 'drop',
  'drug', 'during', 'each', 'early', 'east', 'easy', 'economic', 'economy',
  'edge', 'education', 'effect', 'effort', 'eight', 'either', 'election',
  'else', 'employee', 'energy', 'enjoy', 'enough', 'enter', 'entire',
  'environment', 'environmental', 'especially', 'establish', 'even', 'evening',
  'event', 'ever', 'every', 'everybody', 'everyone', 'everything', 'evidence',
  'exactly', 'example', 'executive', 'exist', 'expect', 'experience', 'expert',
  'explain', 'face', 'fact', 'factor', 'fail', 'fall', 'family', 'fast',
  'father', 'fear', 'federal', 'feel', 'feeling', 'field', 'fight', 'figure',
  'fill', 'film', 'final', 'finally', 'financial', 'find', 'fine', 'finger',
  'finish', 'fire', 'first', 'fish', 'five', 'floor', 'focus', 'follow',
  'food', 'foot', 'force', 'foreign', 'forget', 'form', 'former', 'forward',
  'four', 'free', 'friend', 'from', 'front', 'full', 'fund', 'future',
  'game', 'garden', 'general', 'generation', 'girl', 'give', 'glass',
  'goal', 'good', 'government', 'great', 'green', 'ground', 'group', 'grow',
  'growth', 'guess', 'gun', 'hair', 'half', 'hand', 'hang', 'happen',
  'happy', 'hard', 'have', 'head', 'health', 'hear', 'heart', 'heat',
  'heavy', 'help', 'here', 'herself', 'high', 'himself', 'history', 'hold',
  'home', 'hope', 'hospital', 'hotel', 'hour', 'house', 'however', 'huge',
  'human', 'hundred', 'husband', 'idea', 'identify', 'image', 'imagine',
  'impact', 'important', 'improve', 'include', 'including', 'increase',
  'indeed', 'indicate', 'individual', 'industry', 'information', 'inside',
  'instead', 'institution', 'interest', 'interesting', 'international', 'interview',
  'into', 'investment', 'involve', 'issue', 'item', 'itself', 'join',
  'just', 'keep', 'kill', 'kind', 'kitchen', 'know', 'knowledge', 'land',
  'language', 'large', 'last', 'late', 'later', 'laugh', 'lawyer', 'lead',
  'leader', 'learn', 'least', 'leave', 'left', 'legal', 'less', 'letter',
  'level', 'life', 'light', 'like', 'likely', 'line', 'list', 'listen',
  'little', 'live', 'local', 'long', 'look', 'lose', 'loss', 'love',
  'machine', 'magazine', 'main', 'maintain', 'major', 'majority', 'make',
  'manage', 'management', 'manager', 'many', 'market', 'marriage', 'material',
  'matter', 'maybe', 'mean', 'measure', 'media', 'medical', 'meet',
  'meeting', 'member', 'memory', 'mention', 'message', 'method', 'middle',
  'might', 'military', 'million', 'mind', 'minute', 'miss', 'mission',
  'model', 'modern', 'moment', 'money', 'month', 'more', 'morning', 'most',
  'mother', 'mouth', 'move', 'movement', 'movie', 'much', 'music', 'must',
  'myself', 'name', 'nation', 'national', 'natural', 'nature', 'near',
  'nearly', 'necessary', 'need', 'network', 'never', 'news', 'newspaper',
  'next', 'nice', 'night', 'none', 'north', 'note', 'nothing', 'notice',
  'number', 'occur', 'offer', 'office', 'officer', 'official', 'often',
  'once', 'only', 'onto', 'open', 'operation', 'opportunity', 'option',
  'order', 'organization', 'other', 'others', 'outside', 'over', 'owner',
  'page', 'pain', 'painting', 'paper', 'parent', 'part', 'participant',
  'particular', 'particularly', 'partner', 'party', 'pass', 'past', 'patient',
  'pattern', 'peace', 'people', 'perform', 'performance', 'perhaps', 'period',
  'person', 'personal', 'phone', 'physical', 'pick', 'picture', 'piece',
  'place', 'plan', 'plant', 'play', 'player', 'point', 'police', 'policy',
  'political', 'politics', 'poor', 'popular', 'population', 'position',
  'positive', 'possible', 'power', 'practice', 'prepare', 'present', 'president',
  'pressure', 'pretty', 'prevent', 'price', 'private', 'probably', 'problem',
  'process', 'produce', 'product', 'production', 'professional', 'professor',
  'program', 'project', 'property', 'protect', 'prove', 'provide', 'public',
  'pull', 'purpose', 'push', 'quality', 'question', 'quickly', 'quite',
  'race', 'radio', 'raise', 'range', 'rate', 'rather', 'reach', 'read',
  'ready', 'real', 'reality', 'realize', 'really', 'reason', 'receive',
  'recent', 'recently', 'recognize', 'record', 'reduce', 'reflect', 'region',
  'relate', 'relationship', 'religious', 'remain', 'remember', 'remove',
  'report', 'represent', 'republican', 'require', 'research', 'resource',
  'respond', 'response', 'responsibility', 'rest', 'result', 'return', 'reveal',
  'rich', 'right', 'rise', 'risk', 'road', 'rock', 'role', 'room', 'rule',
  'safe', 'same', 'save', 'scene', 'school', 'science', 'scientist',
  'score', 'season', 'seat', 'second', 'section', 'security', 'seek',
  'seem', 'sell', 'send', 'senior', 'sense', 'series', 'serious', 'serve',
  'service', 'seven', 'several', 'shake', 'share', 'shoot', 'short',
  'shot', 'should', 'shoulder', 'show', 'side', 'sign', 'significant',
  'similar', 'simple', 'simply', 'since', 'sing', 'single', 'sister',
  'site', 'situation', 'size', 'skill', 'skin', 'small', 'smile', 'social',
  'society', 'soldier', 'some', 'somebody', 'someone', 'something', 'sometimes',
  'song', 'soon', 'sort', 'sound', 'source', 'south', 'southern', 'space',
  'speak', 'special', 'specific', 'speech', 'spend', 'sport', 'spring',
  'staff', 'stage', 'stand', 'standard', 'star', 'start', 'state', 'statement',
  'station', 'stay', 'step', 'still', 'stock', 'stop', 'store', 'story',
  'strategy', 'street', 'strong', 'structure', 'student', 'study', 'stuff',
  'style', 'subject', 'success', 'successful', 'such', 'suddenly', 'suffer',
  'suggest', 'summer', 'support', 'sure', 'surface', 'system', 'table',
  'take', 'talk', 'task', 'teach', 'teacher', 'team', 'technology',
  'television', 'tell', 'tend', 'term', 'test', 'than', 'thank', 'that',
  'their', 'them', 'themselves', 'then', 'theory', 'there', 'these', 'they',
  'thing', 'think', 'third', 'this', 'those', 'though', 'thought', 'thousand',
  'threat', 'three', 'through', 'throughout', 'throw', 'thus', 'time',
  'today', 'together', 'tonight', 'tonight', 'total', 'tough', 'toward',
  'town', 'trade', 'traditional', 'training', 'travel', 'treat', 'treatment',
  'tree', 'trial', 'trip', 'trouble', 'true', 'truth', 'turn', 'type',
  'under', 'understand', 'unit', 'until', 'upon', 'usually', 'value',
  'various', 'very', 'victim', 'view', 'violence', 'visit', 'voice', 'vote',
  'wait', 'walk', 'wall', 'want', 'watch', 'water', 'weapon', 'wear',
  'week', 'weight', 'well', 'west', 'western', 'what', 'whatever', 'when',
  'where', 'whether', 'which', 'while', 'white', 'whole', 'whom', 'whose',
  'wide', 'wife', 'will', 'wind', 'window', 'wish', 'with', 'within',
  'without', 'woman', 'wonder', 'word', 'work', 'worker', 'world', 'worry',
  'would', 'write', 'writer', 'wrong', 'yard', 'yeah', 'year', 'young', 'your', 'yourself'
];

/**
 * Generate syllable-based password
 * @param {Object} options
 * @returns {string}
 */
export function generateSyllables(options = {}) {
  const {
    length = 16,
    uppercase = false,
    numbers = true,
    special = false
  } = options;

  const chars = [];
  let currentLength = 0;

  // Add syllables until we reach desired length
  while (currentLength < length) {
    const syllable = pick(SYLLABLES);
    const remaining = length - currentLength;

    if (syllable.length <= remaining) {
      chars.push(...syllable.split(''));
      currentLength += syllable.length;
    } else {
      // Add partial syllable if needed
      chars.push(...syllable.slice(0, remaining).split(''));
      currentLength = length;
    }
  }

  // Apply transformations
  if (uppercase) {
    // Randomly uppercase some letters (30% chance using secure random)
    for (let i = 0; i < chars.length; i++) {
      const randomArray = new Uint32Array(1);
      crypto.getRandomValues(randomArray);
      const secureRandom = randomArray[0] / (0xFFFFFFFF + 1);
      if (secureRandom < 0.3) {  // 30% chance
        chars[i] = chars[i].toUpperCase();
      }
    }
  }

  // Add numbers
  if (numbers) {
    const numCount = Math.max(1, Math.floor(length * 0.2)); // 20% numbers
    const nums = [];
    for (let i = 0; i < numCount; i++) {
      nums.push(String(randInt(0, 9)));
    }
    const result = insertWithPlacement(chars, nums, 'aleatoire');
    return result.slice(0, length).join('');
  }

  // Add special characters
  if (special) {
    const specialChars = '!@#$%^&*'.split('');
    const specCount = Math.max(1, Math.floor(length * 0.1)); // 10% special
    const specs = [];
    for (let i = 0; i < specCount; i++) {
      specs.push(pick(specialChars));
    }
    const result = insertWithPlacement(chars, specs, 'aleatoire');
    return result.slice(0, length).join('');
  }

  return chars.join('');
}

/**
 * Generate passphrase
 * @param {Object} options
 * @returns {string}
 */
export function generatePassphrase(options = {}) {
  const {
    words = 5,
    separator = '-',
    capitalize = false,
    numbers = false
  } = options;

  const selectedWords = [];

  for (let i = 0; i < words; i++) {
    let word = pick(WORDLIST);

    if (capitalize) {
      word = word.charAt(0).toUpperCase() + word.slice(1);
    }

    selectedWords.push(word);
  }

  let passphrase = selectedWords.join(separator);

  if (numbers) {
    const num = randInt(1000, 9999);
    passphrase += separator + num;
  }

  return passphrase;
}

/**
 * Apply leet speak transformation
 * @param {string} text
 * @param {number} level
 * @returns {string}
 */
export function applyLeet(text, level = 2) {
  const leetMap = {
    1: { 'a': '@', 'e': '3', 'i': '1', 'o': '0', 's': '$' },
    2: { 'a': '@', 'e': '3', 'i': '1', 'o': '0', 's': '$', 't': '7', 'l': '1' },
    3: { 'a': '@', 'e': '3', 'i': '1', 'o': '0', 's': '$', 't': '7', 'l': '1', 'g': '9', 'b': '8' }
  };

  const map = leetMap[level] || leetMap[2];
  let result = '';

  for (const char of text) {
    const lower = char.toLowerCase();
    result += map[lower] || char;
  }

  return result;
}

/**
 * Calculate entropy for a password
 * @param {string} password
 * @returns {number}
 */
export function calculatePasswordEntropy(password) {
  let charsetSize = 0;

  if (/[a-z]/.test(password)) charsetSize += 26;
  if (/[A-Z]/.test(password)) charsetSize += 26;
  if (/[0-9]/.test(password)) charsetSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 32; // Approximate special chars

  return calculateEntropy(password.length, charsetSize);
}

/**
 * Get strength meter for password
 * @param {string} password
 * @returns {string}
 */
export function strengthMeter(password) {
  const entropy = calculatePasswordEntropy(password);

  if (entropy < 40) return 'Weak';
  if (entropy < 60) return 'Medium';
  if (entropy < 80) return 'Strong';
  if (entropy < 100) return 'Very Strong';
  return 'Excellent';
}

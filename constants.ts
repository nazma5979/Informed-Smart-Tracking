
import { FeelingNode, RingIndex, ContextTag, Scale } from './types';

// Taxonomy Data Source
// Level 0: Root
// Level 1: Middle Ring
// Level 2: Outer Ring

// Helper to generate nodes
const nodes: Record<string, FeelingNode> = {};

const addNode = (id: string, label: string, parentId: string | null, ringIndex: RingIndex, color: string, textColor?: string) => {
  nodes[id] = { id, label, parentId, ringIndex, color, textColor };
};

// --- Level 0 (Roots) ---
// Using CSS variables for dynamic theming
// Added textColor param to ensure accessibility on bright colors (like Yellow)
const ROOT_COLORS = {
  happy: { bg: 'var(--color-happy)', text: '#422006' }, // Yellow background -> Dark Brown text
  sad: { bg: 'var(--color-sad)', text: undefined },   
  angry: { bg: 'var(--color-angry)', text: undefined }, 
  fearful: { bg: 'var(--color-fearful)', text: undefined }, 
  disgusted: { bg: 'var(--color-disgusted)', text: '#14532d' }, // Light green -> Dark Green text
  surprised: { bg: 'var(--color-surprised)', text: '#064e3b' }, // Teal -> Dark Teal text
  bad: { bg: 'var(--color-bad)', text: undefined },   
};

// 1. HAPPY
addNode('happy', 'Happy', null, RingIndex.Centre, ROOT_COLORS.happy.bg, ROOT_COLORS.happy.text);

const happyTree = [
  { mid: 'Playful', outer: ['Aroused', 'Cheeky'] },
  { mid: 'Content', outer: ['Free', 'Joyful'] },
  { mid: 'Interested', outer: ['Curious', 'Inquisitive'] },
  { mid: 'Proud', outer: ['Successful', 'Confident'] },
  { mid: 'Accepted', outer: ['Respected', 'Valued'] },
  { mid: 'Powerful', outer: ['Courageous', 'Creative'] },
  { mid: 'Peaceful', outer: ['Loving', 'Thankful'] },
  { mid: 'Trusting', outer: ['Sensitive', 'Intimate'] },
  { mid: 'Optimistic', outer: ['Hopeful', 'Inspired'] },
];

// 2. SAD
addNode('sad', 'Sad', null, RingIndex.Centre, ROOT_COLORS.sad.bg, ROOT_COLORS.sad.text);

const sadTree = [
  { mid: 'Lonely', outer: ['Abandoned', 'Isolated'] },
  { mid: 'Vulnerable', outer: ['Victimised', 'Fragile'] },
  { mid: 'Despair', outer: ['Grief', 'Helpless'] },
  { mid: 'Guilty', outer: ['Regretful', 'Ashamed'] },
  { mid: 'Hurt', outer: ['Embarrassed', 'Disappointed'] },
  { mid: 'Depressed', outer: ['Inferior', 'Empty'] },
  { mid: 'Ashamed', outer: ['Remorseful', 'Guilty'] }, // Note: Duplicate "Guilty" as leaf handled by unique ID generation
];

// 3. ANGRY
addNode('angry', 'Angry', null, RingIndex.Centre, ROOT_COLORS.angry.bg, ROOT_COLORS.angry.text);

const angryTree = [
  { mid: 'Let down', outer: ['Betrayed', 'Resentful'] },
  { mid: 'Humiliated', outer: ['Disrespected', 'Ridiculed'] },
  { mid: 'Bitter', outer: ['Indignant', 'Violated'] },
  { mid: 'Mad', outer: ['Furious', 'Angry'] }, // Note: "Angry" as leaf
  { mid: 'Aggressive', outer: ['Provoked', 'Hostile'] },
  { mid: 'Frustrated', outer: ['Infuriated', 'Annoyed'] },
  { mid: 'Distant', outer: ['Withdrawn', 'Numb'] },
  { mid: 'Critical', outer: ['Skeptical', 'Dismissive'] },
];

// 4. FEARFUL
addNode('fearful', 'Fearful', null, RingIndex.Centre, ROOT_COLORS.fearful.bg, ROOT_COLORS.fearful.text);

const fearfulTree = [
  { mid: 'Scared', outer: ['Helpless', 'Frightened'] },
  { mid: 'Anxious', outer: ['Overwhelmed', 'Worried'] },
  { mid: 'Insecure', outer: ['Inadequate', 'Inferior'] },
  { mid: 'Weak', outer: ['Worthless', 'Insignificant'] },
  { mid: 'Rejected', outer: ['Excluded', 'Persecuted'] },
  { mid: 'Threatened', outer: ['Nervous', 'Exposed'] },
];

// 5. DISGUSTED
addNode('disgusted', 'Disgusted', null, RingIndex.Centre, ROOT_COLORS.disgusted.bg, ROOT_COLORS.disgusted.text);

const disgustedTree = [
  { mid: 'Disapproving', outer: ['Disappointed', 'Awful'] },
  { mid: 'Disappointed', outer: ['Appalled', 'Horrified'] },
  { mid: 'Awful', outer: ['Nauseated', 'Revolted'] },
  { mid: 'Repelled', outer: ['Disgusted', 'Horrified'] },
];

// 6. SURPRISED
addNode('surprised', 'Surprised', null, RingIndex.Centre, ROOT_COLORS.surprised.bg, ROOT_COLORS.surprised.text);

const surprisedTree = [
  { mid: 'Startled', outer: ['Shocked', 'Dismayed'] },
  { mid: 'Confused', outer: ['Disillusioned', 'Perplexed'] },
  { mid: 'Amazed', outer: ['Astonished', 'Awe'] },
  { mid: 'Excited', outer: ['Eager', 'Energetic'] },
];

// 7. BAD
addNode('bad', 'Bad', null, RingIndex.Centre, ROOT_COLORS.bad.bg, ROOT_COLORS.bad.text);

const badTree = [
  { mid: 'Bored', outer: ['Indifferent', 'Apathetic'] },
  { mid: 'Busy', outer: ['Pressured', 'Rushed'] },
  { mid: 'Stressed', outer: ['Overwhelmed', 'Out of control'] },
  { mid: 'Tired', outer: ['Sleepy', 'Unfocused'] },
];

// Helper to build the tree
const buildTree = (rootId: string, tree: { mid: string, outer: string[] }[], color: string, textColor?: string) => {
  tree.forEach(branch => {
    // Create Level 1 ID: e.g., happy_playful
    const midId = `${rootId}_${branch.mid.toLowerCase().replace(/\s+/g, '_')}`;
    addNode(midId, branch.mid, rootId, RingIndex.Middle, color, textColor);

    // Create Level 2 IDs
    branch.outer.forEach(leafLabel => {
      // Ensure unique IDs even if labels repeat (like "Guilty" appearing as mid and leaf)
      const leafId = `${midId}_${leafLabel.toLowerCase().replace(/\s+/g, '_')}`;
      addNode(leafId, leafLabel, midId, RingIndex.Outer, color, textColor);
    });
  });
};

// Execute Build
buildTree('happy', happyTree, ROOT_COLORS.happy.bg, ROOT_COLORS.happy.text);
buildTree('sad', sadTree, ROOT_COLORS.sad.bg, ROOT_COLORS.sad.text);
buildTree('angry', angryTree, ROOT_COLORS.angry.bg, ROOT_COLORS.angry.text);
buildTree('fearful', fearfulTree, ROOT_COLORS.fearful.bg, ROOT_COLORS.fearful.text);
buildTree('disgusted', disgustedTree, ROOT_COLORS.disgusted.bg, ROOT_COLORS.disgusted.text);
buildTree('surprised', surprisedTree, ROOT_COLORS.surprised.bg, ROOT_COLORS.surprised.text);
buildTree('bad', badTree, ROOT_COLORS.bad.bg, ROOT_COLORS.bad.text);

export const FEELING_NODES = nodes;

// Helper to get children
export const getChildren = (parentId: string | null): FeelingNode[] => {
  return Object.values(FEELING_NODES).filter(node => node.parentId === parentId);
};

// Helper to get the full path of emotions for a given node ID
export const getEmotionPath = (nodeId: string): FeelingNode[] => {
  const path: FeelingNode[] = [];
  let current = FEELING_NODES[nodeId];
  while (current) {
    path.unshift(current);
    if (!current.parentId) break;
    current = FEELING_NODES[current.parentId];
  }
  return path;
};

export const DEFAULT_TAGS: ContextTag[] = [
  { id: 'family', category: 'people', label: 'Family' },
  { id: 'friends', category: 'people', label: 'Friends' },
  { id: 'partner', category: 'people', label: 'Partner' },
  { id: 'alone', category: 'people', label: 'Alone' },
  { id: 'colleagues', category: 'people', label: 'Colleagues' },
  { id: 'home', category: 'place', label: 'Home' },
  { id: 'work', category: 'place', label: 'Work' },
  { id: 'transit', category: 'place', label: 'Transit' },
  { id: 'nature', category: 'place', label: 'Nature' },
  { id: 'public', category: 'place', label: 'Public' },
  { id: 'exercise', category: 'activity', label: 'Exercise' },
  { id: 'relaxing', category: 'activity', label: 'Relaxing' },
  { id: 'working', category: 'activity', label: 'Working' },
  { id: 'eating', category: 'activity', label: 'Eating' },
  { id: 'social_media', category: 'activity', label: 'Social Media' },
  { id: 'chores', category: 'activity', label: 'Chores' },
  { id: 'good_sleep', category: 'sleep', label: 'Good Sleep' },
  { id: 'bad_sleep', category: 'sleep', label: 'Bad Sleep' },
  { id: 'sunny', category: 'weather', label: 'Sunny' },
  { id: 'rainy', category: 'weather', label: 'Rainy' },
];

export const DEFAULT_SCALES: Scale[] = [
  { id: 'energy', label: 'Energy', minLabel: 'Drained', maxLabel: 'Hyper', min: 1, max: 5, step: 1, defaultValue: 3 },
  { id: 'stress', label: 'Stress', minLabel: 'Calm', maxLabel: 'Panicked', min: 1, max: 5, step: 1, defaultValue: 1 },
  { id: 'focus', label: 'Focus', minLabel: 'Scattered', maxLabel: 'Laser', min: 1, max: 5, step: 1, defaultValue: 3 },
];
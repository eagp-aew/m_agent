export const PRIMARY_SECTIONS = [
  { surface: 'Chat', label: '对话', symbol: '✦', hint: '从一句话开始' },
  { surface: 'Today', label: '今天', symbol: '◎', hint: '看看需要你决定的事' },
  { surface: 'Core Memory', label: '记忆', symbol: '◫', hint: '了解、纠正与带入资料' },
];

export const SECONDARY_SECTIONS = [
  { surface: 'Chat', label: '聊天', primary: 'Chat' },
  { surface: 'Learning', label: '学习', primary: 'Chat' },
  { surface: 'Reflection', label: '周复盘', primary: 'Chat' },
  { surface: 'Core Memory', label: '关于我', primary: 'Core Memory' },
  { surface: 'Memory Changes', label: '变更与忘记', primary: 'Core Memory' },
  { surface: 'Archive', label: '经历与资料', primary: 'Core Memory' },
  { surface: 'Import', label: '带入旧资料', primary: 'Core Memory' },
];

export const PROMPT_STARTERS = [
  '帮我理清一件事：',
  '我想学一个概念：',
  '陪我回顾一下最近的进展：',
];

export function primaryForSurface(surface) {
  if (surface === 'Today') return 'Today';
  return SECONDARY_SECTIONS.find((item) => item.surface === surface)?.primary ?? null;
}

// Suggestions never replace unfinished work, including its original whitespace.
export function preparePromptDraft(currentDraft, prompt) {
  return currentDraft.trim() ? currentDraft : prompt;
}

// Only clear the exact submitted draft after the complete workflow succeeds.
export function completeChatDraft(currentDraft, submittedDraft, succeeded) {
  return succeeded && currentDraft === submittedDraft ? '' : currentDraft;
}

export interface IdeaSuggestion {
  title: string
  ourAngle: string
  suggestedFormat: string
  hook: string
  whyItWorks: string
  tags: string[]
}

export const ideaSuggestions: IdeaSuggestion[] = [
  {
    title: '最近很多商家开始倒闭了，你怎样看？',
    ourAngle: '从服务大量 SME 的经验出发，讨论企业经营出现问题时，老板最应该注意哪些早期信号。',
    suggestedFormat: '老板观点 / Q&A',
    hook: '最近好像越来越多店关门，真的是市场变差这么简单吗？',
    whyItWorks: '贴近 SME 老板近期关心的经营压力，以经验和早期信号切入，能引出实用讨论而不是替观众下结论。',
    tags: ['老板IP', '企业经营', 'SME', '现金流'],
  },
  {
    title: '做过这么多家企业的系统，最喜欢怎样的顾客？什么样的顾客最难合作？',
    ourAngle: '从多年企业客户服务经验，分享什么特质会让企业与系统供应商合作更顺利。',
    suggestedFormat: '轻松 Q&A',
    hook: '做了这么多年系统，有没有一种顾客你一听就知道会很好合作？',
    whyItWorks: '问题具有人情味，也能自然体现长期服务企业客户所累积的经验，同时避免点名或批评个别顾客。',
    tags: ['老板IP', '客户关系', '企业服务', '创业'],
  },
  {
    title: '不是已经有 SST 了吗？为什么安华又提 GST？',
    ourAngle: '结合近期 GST / SST 讨论，用企业老板容易理解的方式解释为什么 GST 又成为话题。',
    suggestedFormat: '热点 Q&A / 教育',
    hook: 'SST 都已经在用了，为什么最近又开始讨论 GST？',
    whyItWorks: '用老板熟悉的语言拆解热门商业议题，兼顾时效性与教育价值；最终内容仍应以最新官方信息为准。',
    tags: ['GST', 'SST', 'Malaysia Business', '老板IP', '税务'],
  },
  {
    title: '你觉得一个企业里面，什么部门最重要？',
    ourAngle: '从企业经营经验讨论销售、财务、运营、人事之间真正的重要性与协作关系。',
    suggestedFormat: '老板观点',
    hook: '如果一家公司只能先把一个部门做好，你会选哪一个？',
    whyItWorks: '容易引发团队与老板讨论，并提供从单一部门问题延伸到跨部门协作的空间。',
    tags: ['企业管理', '老板IP', '团队', '经营'],
  },
  {
    title: '为什么公司名字叫 LKSOFT？',
    ourAngle: '分享 LKSoft 名字由来、品牌故事及创业背景。',
    suggestedFormat: 'Brand Story / Q&A',
    hook: '很多人认识 LKSoft，但可能从来没问过：为什么叫 LKSoft？',
    whyItWorks: '品牌名称自带好奇心，适合用个人回忆建立真实感，并让观众更容易记住 LKSoft 的创业故事。',
    tags: ['LKSoft', '品牌故事', '创业', '老板IP'],
  },
  {
    title: '你觉得怎样的企业或老板，会有很好的发展？',
    ourAngle: '从接触不同企业与老板的经验，讨论有长期成长潜力的共同特征。',
    suggestedFormat: '老板观点 / Leadership',
    hook: '你接触过这么多老板，有没有一些特征，一看就知道这家公司会越做越好？',
    whyItWorks: '以长期观察归纳成长特征，能带出领导力与经营习惯，同时保留 Steven 对重点的最终判断。',
    tags: ['企业成长', '老板', 'Leadership', '创业'],
  },
  {
    title: '很多人讲00后很难融入企业文化，你怎样看？',
    ourAngle: '从老板角度讨论年轻员工、企业文化、管理方式与世代差异，不预设批评立场。',
    suggestedFormat: '观点 / Q&A',
    hook: '到底是00后难融入公司，还是公司的管理方式还停在以前？',
    whyItWorks: '世代议题有讨论度，以双向问题切入可避免先入为主，并为年轻员工与管理者都保留表达空间。',
    tags: ['00后', '企业文化', '管理', '老板IP', '职场'],
  },
]

function normalizeTitle(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('zh-CN')
}

export function findIdeaSuggestion(title: string) {
  const normalized = normalizeTitle(title)
  if (!normalized) return null
  return ideaSuggestions.find((suggestion) => normalizeTitle(suggestion.title) === normalized) ?? null
}

export function applySuggestionIfEmpty(currentValue: string, suggestion: string) {
  return currentValue.trim() ? currentValue : suggestion
}

export function mergeSuggestedTags(currentValue: string, suggestions: string[]) {
  const current = currentValue
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
  const seen = new Set(current.map((tag) => tag.toLocaleLowerCase('en')))
  const merged = [...current]

  for (const suggestion of suggestions) {
    const key = suggestion.toLocaleLowerCase('en')
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(suggestion)
    }
  }

  return merged.join(', ')
}

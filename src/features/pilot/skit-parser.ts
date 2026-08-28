export interface SkitCastMember { name: string; role: string }
export interface SkitDialogue { character: string; line: string }

export interface SkitSegment {
  id: string
  kind: 'scene'
  prompt: string
  referenceScript: string
  keywords: string[]
  visualCue: string
  onScreenText: string
  isShot: boolean
  dialogues: SkitDialogue[]
  action: string
  cast?: SkitCastMember[]
  rawText: string
}

const sceneHeading = /^镜头\s*(\d+)\s*(?:[｜|:：\-—]\s*(.*))?$/u
const reservedLabels = new Set(['字幕', '屏幕字幕', '动作', '画面', '动作 / 画面说明', '动作/画面说明', 'B-roll', 'B roll', '画面提示'])

function cleanQuote(value: string) {
  return value.trim().replace(/^[“”"']+|[“”"']+$/gu, '').trim()
}

function parseCast(prefix: string): SkitCastMember[] {
  const start = prefix.split(/\r?\n/u).findIndex((line) => /^角色\s*[:：]?\s*$/u.test(line.trim()))
  if (start < 0) return []
  return prefix.split(/\r?\n/u).slice(start + 1).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [name, ...role] = line.split(/[｜|]/u)
    return { name: name.trim(), role: role.join('｜').trim() }
  }).filter((item) => item.name && !sceneHeading.test(item.name))
}

function parseScene(block: string, index: number, cast: SkitCastMember[]): SkitSegment {
  const lines = block.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean)
  const heading = lines.shift() ?? `镜头 ${index + 1}`
  const match = heading.match(sceneHeading)
  const sceneNumber = match?.[1] ?? String(index + 1)
  const sceneTitle = match?.[2]?.trim() || `镜头 ${sceneNumber}`
  const dialogues: SkitDialogue[] = []
  const actions: string[] = []
  const visuals: string[] = []
  let subtitle = ''
  let pendingCharacter = ''

  for (const line of lines) {
    const labelled = line.match(/^([^：:]{1,30})[：:]\s*(.*)$/u)
    if (labelled) {
      const label = labelled[1].trim()
      const value = labelled[2].trim()
      if (label === '字幕' || label === '屏幕字幕') subtitle = cleanQuote(value)
      else if (label === '动作' || label === '画面' || label.includes('动作')) actions.push(value)
      else if (/^(?:B-roll|B roll|画面提示)$/iu.test(label)) visuals.push(value)
      else if (!reservedLabels.has(label)) {
        if (value) dialogues.push({ character: label, line: cleanQuote(value) })
        else pendingCharacter = label
      }
      continue
    }
    if (pendingCharacter) {
      dialogues.push({ character: pendingCharacter, line: cleanQuote(line) })
      pendingCharacter = ''
    } else {
      actions.push(line)
    }
  }

  return {
    id: `scene-${sceneNumber}-${index + 1}`,
    kind: 'scene',
    prompt: sceneTitle,
    referenceScript: dialogues.map((item) => `${item.character}：${item.line}`).join('\n'),
    keywords: [],
    visualCue: visuals.join('\n'),
    onScreenText: subtitle,
    isShot: false,
    dialogues,
    action: actions.join('\n'),
    cast: index === 0 ? cast : undefined,
    rawText: block.trim(),
  }
}

export function parseSkitContent(rawContent: string): SkitSegment[] {
  const raw = rawContent.trim()
  if (!raw) return []
  const matches = [...raw.matchAll(/^镜头\s*\d+[^\r\n]*$/gmu)]
  const cast = parseCast(matches[0] ? raw.slice(0, matches[0].index) : raw)
  if (!matches.length) {
    return [{
      id: 'scene-1-1', kind: 'scene', prompt: '完整原始内容', referenceScript: raw,
      keywords: [], visualCue: '', onScreenText: '', isShot: false, dialogues: [],
      action: '', cast, rawText: raw,
    }]
  }
  return matches.map((match, index) => parseScene(raw.slice(match.index, matches[index + 1]?.index ?? raw.length), index, cast))
}

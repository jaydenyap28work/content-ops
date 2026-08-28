import { describe, expect, it } from 'vitest'
import { parseSkitContent } from './skit-parser'

describe('parseSkitContent', () => {
  it('maps cast, scenes, dialogue, action and subtitle deterministically', () => {
    const result = parseSkitContent(`角色\nSteven｜老板\n员工 A｜正常人\n\n镜头1｜Hook\n员工 A：\n“为什么大家一听到加班都这么开心？”\nSteven：“今晚可能要辛苦一下。”\n动作：Steven 走进会议室\n字幕：“有些动力，确实比较实际。”\n\n镜头2｜反应\n员工 A：马上可以`)
    expect(result).toHaveLength(2)
    expect(result[0].cast).toEqual([{ name: 'Steven', role: '老板' }, { name: '员工 A', role: '正常人' }])
    expect(result[0].dialogues).toEqual([
      { character: '员工 A', line: '为什么大家一听到加班都这么开心？' },
      { character: 'Steven', line: '今晚可能要辛苦一下。' },
    ])
    expect(result[0]).toMatchObject({ prompt: 'Hook', action: 'Steven 走进会议室', onScreenText: '有些动力，确实比较实际。' })
  })

  it('preserves uncertain input as one editable scene', () => {
    const raw = '一段无法确定结构的完整脚本\n不要丢失'
    expect(parseSkitContent(raw)[0]).toMatchObject({ prompt: '完整原始内容', referenceScript: raw, rawText: raw })
  })
})

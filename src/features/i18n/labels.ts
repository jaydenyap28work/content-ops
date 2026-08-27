import type { Language } from './i18n'

const zh: Record<string, string> = {
  new: '新选题', evaluating: '评估中', approved: '已确认', converted: '已转制作', rejected: '已搁置', archived: '已归档',
  draft: '草稿', ready_to_shoot: '待拍摄', shooting: '拍摄中', shot_awaiting_edit: '已拍摄 / 待剪辑', editing: '剪辑中',
  first_cut_submitted: '初剪已提交', internal_review: '审核中', revision_required: '需要修改', client_review: '客户审核',
  ready_for_publishing: '待发布', analytics_tracking: '数据追踪中', completed: '已完成', cancelled: '已取消',
  not_published: '未发布', partially_published: '部分已发布', fully_published: '已发布', needs_attention: '需要处理',
  low: '低', normal: '普通', high: '高', urgent: '紧急',
  PLAN: '计划', SHOOT: '🎥 拍摄', REVIEW: '审核', PUBLISH: '发布',
  active: '启用', external_client: '外部客户', internal_brand: '内部品牌',
}

export function enumLabel(value: string, language: Language) {
  if (language === 'zh-CN') return zh[value] ?? value
  return value.split('_').map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(' ')
}

export function formatWorkspaceDate(value: string | null, language: Language, options?: Intl.DateTimeFormatOptions) {
  if (!value) return language === 'zh-CN' ? '未安排' : 'Not scheduled'
  return new Intl.DateTimeFormat(language === 'zh-CN' ? 'zh-CN' : 'en-MY', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: 'short', day: '2-digit', ...options,
  }).format(new Date(value.length === 10 ? `${value}T12:00:00+08:00` : value))
}
